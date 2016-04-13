/**
 * Prepares tab to use with LiveStyle: injects content scripts for newly added
 * tabs with active sessions and requests CSSOM stylesheets
 */
'use strict';

import {TAB, SESSION} from 'extension-app/lib/action-names';
import app from '../lib/app';
import {error, serialize} from '../lib/utils';

const mainFrame = {frameId: 0};
const tabsWithInjectedScripts = new Set();
const tabsPendingInjection = new Set();

// For new tabs with sessions, inject content script
app.subscribe(prepareTabs, 'tabs');

// When a user stylesheets updated in host page, update matched tab sessions as well
app.subscribeDeepKey('sessions', 'userStylesheets', (session, id) => {
    var tabs = app.getStateValue('tabs');
    for (let [tabId, tab] of tabs) {
        if (tab.session && tab.session.id === id) {
            syncUserStylesheets(tabId);
        }
    }
});

/**
 * Default function is a listener for `tabs` storage key updates
 * @param  {Map} tabs
 */
function prepareTabs(tabs) {
	var allTabIds = new Set(tabs.keys());
	var tabsToInject = [];

	// find tab ids where content script should be injected
	for (let [tabId, tab] of tabs) {
		if (tab.session && !tabsWithInjectedScripts.has(tabId) && !tabsPendingInjection.has(tabId)) {
			tabsToInject.push(tabId);
		}
	}

	// remove tab ids that no longer available in Chrome
	tabsWithInjectedScripts.forEach(tabId => !tabs.has(tabId) && tabsWithInjectedScripts.delete(tabId));

	if (!tabsToInject.length) {
		return;
	}

	// Since script injection is async process, there’s a chance that store
	// will receive update during injection process.
	// Considering that, store tab ids that waiting for injection in separate
	// set and empty it when process is complete
	tabsToInject.forEach(tabId => tabsPendingInjection.add(tabId));
	Promise.all(tabsToInject.map(injectContentScript))
	.then(injectedTabIds => {
		// when script is injected, request CSSOM stylesheets
		return Promise.all(injectedTabIds.map(getCSSOMStylesheets))
		.then(() => Promise.all(injectedTabIds.map(syncUserStylesheets)))
		.then(() => injectedTabIds);
	})
	.catch(err => {
		console.warn(err);
		return tabsToInject;
	})
	.then(injectedTabIds => {
		// cleanup
		injectedTabIds.forEach(tabId => tabsPendingInjection.delete(tabId));
	});
}

function injectContentScript(tabId) {
    return new Promise(resolve => {
        // first, check if content script wasn’t injected yet
        chrome.tabs.sendMessage(tabId, {action: 'content-script-available'}, mainFrame, resp => {
            if (resp) {
                // script is already injected
                return resolve(tabId);
            }

            // XXX: Check if Re:view is available and inject script into views
            // as well. Or make sure content script controls Re:view viewports
            chrome.tabs.executeScript(tabId, {file: 'content-script.js'}, () => resolve(tabId));
        });
    })
	.then(tabId => {
		tabsWithInjectedScripts.add(tabId);
		return tabId;
	});
}

/**
 * Fetches CSSOM stylesheets from given tab and updates them in app store
 * @param  {Number} tabId
 * @return {Promise}
 */
function getCSSOMStylesheets(tabId) {
	return new Promise(resolve => {
		chrome.tabs.sendMessage(tabId, {action: 'get-stylesheets'}, mainFrame, items => {
			setStylesheetData(tabId, 'cssom', items);
			resolve(items);
		});
	});
}

/**
 * Synchronizes user stylesheets with page in given `tabId`: removes redundant
 * and adds missing stylesheets
 * @param  {Number} tabId
 * @param  {Object} session
 * @param  {Object} page
 * @return {Promise}
 */
function syncUserStylesheets(tabId) {
    var state = app.getState();
    var tab = state.tabs.get(tabId);
    var session = tab && tab.session && state.sessions.get(tab.session.id);
    if (!session) {
        return Promise.reject(error('ENOTABSESSION', 'No active LiveStyle session for tab ' + tabId));
    }

	// the `user` zone in tab stylesheets holds local-to-global references,
	// convert them to global-to-local
    var tabStylesheets = transpose(tab.stylesheets.user);

	var stylesheets = {}, emptyStylesheets = [];
    for (let userStylesheet of session.userStylesheets) {
		if (tabStylesheets.has(userStylesheet)) {
			items[userStylesheet] = tabStylesheets.get(userStylesheet);
		} else {
			items[userStylesheet] = null;
			emptyStylesheets.push(userStylesheet);
		}
    }

    return createUserStylesheetUrls(tabId, emptyStylesheets)
    .then(createdStylesheets => new Promise(resolve => {
        chrome.tabs.sendMessage(tabId, {
            action: 'sync-user-stylesheets',
            data: {
                items: {...stylesheets, ...createdStylesheets}
            }
        }, resp => {
			setStylesheetData(tabId, 'user', transpose(resp));
            resolve(resp);
        });
    }));
}

/**
 * Creates local URLs for new user stylesheets (e.g. `items` with empty values).
 * These URLs can be used across inner frames
 * @param  {Array} items Array of global stylesheet IDs
 * @return {Promise}
 */
function createUserStylesheetUrls(tabId, items) {
    return new Promise(resolve => {
        if (!items.length) {
            return resolve({});
        }

        // create URLs in main frame only
        chrome.tabs.sendMessage(tabId, {
            action: 'create-user-stylesheet-url',
            data: {stylesheetId: items}
        }, mainFrame, resp => resolve(resp || {}));
    });
}

/**
 * Swaps keys with values in given object or map
 * @param  {Object|Map} obj
 * @return {Map}
 */
function transpose(obj) {
	var result = new Map();
	if (obj instanceof Map) {
		for (let [k, v] of obj) {
            result.set(v, k);
        }
	} else if (obj && typeof obj === 'object') {
		Object.keys(obj).forEach(k => result.set(obj[k], k));
	}

	return result;
}

function setStylesheetData(id, zone, items) {
	if (items) {
		app.dispatch({type: TAB.SET_STYLESHEET_DATA, id, items, zone});
	}
	return items;
}
