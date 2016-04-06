'use strict';
import client from 'livestyle-client';
import extensionApp from 'extension-app';
import {TAB, SESSION} from 'extension-app/lib/action-names';
import {stringifyPatch, throttle, serialize} from './lib/utils';
import {forEditor, forBrowser} from './app/diff';
import patcher from './app/patcher';
import devtoolsUpdate from './chrome/devtools';
import updateBrowserIcon from './chrome/browser-icon';
import updatePopups from './chrome/popup';
import getStylesheetContent from './chrome/get-stylesheet-content';

const CLIENT_ID = {id: 'chrome'};
const storage = chrome.storage.local;
const storageKey = 'livestyle2';
const curSessions = new Map();
const mainFrame = {frameId: 0};
const tabsQuery = {
    windowType: 'normal',
    status: 'complete'
};

const app = extensionApp(client, {
    logger: process.env.NODE_ENV !== 'production'
});

// TODO import data from old storage
const saveDataToStorage = throttle(state => {
    storage.set({[storageKey]: {sessions: serialize(state.sessions)}}, () => {
        if (chrome.runtime.lastError) {
            console.error('Unable to save LiveStyle state', chrome.runtime.lastError);
        }
    });
}, 3000);

client.on('message-send', function(name, data) {
	console.log('send message %c%s', 'font-weight:bold', name);
	if (name === 'diff') {
		// sending `diff` message from worker:
		// server won’t send it back to sender so handle it manually
		applyDiff(data);
	}
})
.on('diff', applyDiff)
.on('open identify-client', identify)
.on('message-receive', (name, data) => console.log('received message %c%s: %o', 'font-weight:bold', name, data))
.connect();

// subscribe to Chrome lifecycle events and keep store up-to-date
['onCreated', 'onUpdated', 'onRemoved', 'onReplaced']
.forEach(key => chrome.tabs[key].addListener(syncTabs));

// Broadcast storage update to all connected popups
app.subscribe(updatePopups);

// Update browser icon state when tabs are updated
app.subscribe(updateBrowserIcon, 'tabs');

// For newly created sessions, request unsaved changes for mapped editor files
app.subscribeDeepKey('tabs', 'session.mapping', (tab, tabId) => {
    var session = tab.session;
    var requested = session.requestedUnsavedFiles;
    var files = Array.from(session.mapping.values())
    .filter(file => !requested.has(file));

    if (files.length) {
        app.dispatch({type: TAB.ADD_REQUESTED_UNSAVED_FILES, files});
        client.send('request-unsaved-changes', {files});
    }
});

// When a user stylesheets updated in host page, update matched tab sessions as well
app.subscribeDeepKey('sessions', 'userStylesheets', (session, id) => {
    var tabs = app.getStateValue('tabs');
    for (let [tabId, tab] of tabs) {
        if (tab.session && tab.session.id === id) {
            syncUserStylesheets(tabId, tab, session);
        }
    }
});

// Save LiveStyle data to storage
app.subscribe(saveDataToStorage);

// Load saved data
storage.get(storageKey, data => {
	app.dispatch({
		type: SESSION.LOAD,
		sessions: data[storageKey] || {}
	});
	syncTabs();
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.name === 'get-stylesheet-content' && sender.tab) {
        getStylesheetContent(sender.tab.id, message.data.url)
        .then(sendResponse)
        .catch(err => {
            console.error('Unable to fetch stylesheet content', err);
            sendResponse(null);
        });
        return true;
    }
});

function identify() {
	client.send('client-id', CLIENT_ID);
}

function applyDiff(diff) {
    forEditor(diff).forEach(payload => client.send('incoming-updates', payload));
    forBrowser(diff).forEach(payload => {
        chrome.tabs.sendMessage(payload.tabId, {
            action: 'apply-cssom-patch',
            data: {
                stylesheetUrl: payload.uri,
                patches: payload.patches
            }
        });
        dispatch({
            type: TAB.SAVE_PATCHES,
            id: payload.tabId,
            uri: payload.uri,
            patches: payload.patches
        });

        logPatches(payload.tabId, payload.uri, payload.patches);
    });
}

function logPatches(tabId, url, patches) {
	console.groupCollapsed('apply diff on %s in tab %d', url, tabId);
	patches.forEach(p => console.log(stringifyPatch(p)));
	console.groupEnd();
}

function getSessions() {
	return curSessions;
}

function fetchCSSOMStylesheets(tabId) {
    // always request stylesheets from main frame
    chrome.tabs.sendMessage(tabId, {action: 'get-stylesheets'}, mainFrame, items => {
        dispatch({type: SESSION.SET_CSSOM_STYLESHEETS, tabId, items});
    });
}

function fetchTabInfo(tab) {
    return new Promise(resolve => {
        chrome.tabs.sendMessage(tab.id, {action: 'get-tab-info'}, mainFrame, info => {
            resolve({...info, id: tab.id});
        });
    });
}

/**
 * Syncronizes currently opened tab list with app store
 */
function syncTabs() {
    chrome.tabs.query(tabsQuery, tabs => {
        var storeTabs = app.getStateValue('tabs');
        // first, fetch info for new tabs (e.g. ones not in store) from content script
        Promise.all(tabs.filter(tab => !storeTabs.has(tab.id)).map(fetchTabInfo))
        .then(newTabs => {
            newTabs = newTabs.reduce((out, tab) => out.set(tab.id, tab), new Map());
            var finalTabs = tabs.reduce((out, tab) => {
                var tabData = storeTabs.get(tab.id) || newTabs.get(tab.id);
                if (tabData) {
                    out.set(tab.id, {origin: tabData.origin, url: tab.url});
                }
                return out;
            });
            app.dispatch({type: TAB.UPDATE_LIST, tabs: finalTabs});

            // for new tabs, explicitly set CSSOM stylesheets
            for (let [id, tab] of newTabs) {
                app.dispatch({
                    type: TAB.SET_STYLESHEET_DATA,
                    id,
                    items: tab.stylesheets || [],
                    zone: 'cssom'
                });
            }
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
function syncUserStylesheets(tabId, session, page) {
    var pageStylesheets = page.userStylesheets || [];
    var sessionStylesheets = session.userStylesheets || new Map();
    var items = pageStylesheets.reduce((out, id) => {
        out[id] = sessionStylesheets.get(id) || null;
        return out;
    }, {});

    return createUserStylesheetUrls(tabId, items)
    .then(items => new Promise(resolve => {
        chrome.tabs.sendMessage(tabId, {
            action: 'sync-user-stylesheets',
            data: {items}
        }, resp => {
            if (resp) {
                dispatch({
                    type: SESSION.SET_USER_STYLESHEETS,
                    tabId,
                    items: serialize(resp)
                });
            }
            resolve(resp);
        });
    }));
}

/**
 * Creates local URLs for new user stylesheets (e.g. `items` with empty values).
 * These URLs can be used across inner frames
 * @param  {Object} items User stylesheet mappings
 * @return {Promise}
 */
function createUserStylesheetUrls(tabId, items) {
    return new Promise(resolve => {
        var emptyItems = Object.keys(items).filter(id => !items[id]);
        if (!emptyItems.length) {
            return resolve(items);
        }

        // create URLs in main frame only
        chrome.tabs.sendMessage(tabId, {
            action: 'create-user-stylesheet-url',
            data: {userId: emptyItems}
        }, mainFrame, resp => {
            resolve({...items, ...(resp || {})});
        });
    });
}
