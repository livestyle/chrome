'use strict';
import {TAB, SESSION} from 'extension-app/lib/action-names';
import app from './lib/app';
import {throttle, serialize} from './lib/utils';
import patcher from './lib/patcher';
import logPatches from './lib/patch-logger';
import updateBrowserIcon from './chrome/browser-icon';
import updatePopups from './chrome/popup';
import getStylesheetContent from './chrome/get-stylesheet-content';

import './chrome/devtools';

const storage = chrome.storage.local;
const storageKey = 'livestyle2';
const clientId = {id: 'chrome'};
const mainFrame = {frameId: 0};
const tabsQuery = {
    windowType: 'normal',
    status: 'complete'
};

// TODO import data from old storage
const saveDataToStorage = throttle(state => {
    storage.set({[storageKey]: {sessions: serialize(state.sessions)}}, () => {
        if (chrome.runtime.lastError) {
            console.error('Unable to save LiveStyle state', chrome.runtime.lastError);
        }
    });
}, 3000);

// Load saved data
storage.get(storageKey, data => {
	app.dispatch({
		type: SESSION.LOAD,
		sessions: data[storageKey] || {}
	});
	syncTabs();
});

// Save LiveStyle data to storage
app.subscribe(saveDataToStorage);

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
        app.client.send('request-unsaved-changes', {files});
    }
});

// When a user stylesheets updated in host page, update matched tab sessions as well
app.subscribeDeepKey('sessions', 'userStylesheets', (session, id) => {
    var tabs = app.getStateValue('tabs');
    for (let [tabId, tab] of tabs) {
        if (tab.session && tab.session.id === id) {
            syncUserStylesheets(tabId);
        }
    }
});

app.client.on('message-send', function(name, data) {
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
	app.client.send('client-id', clientId);
}

function applyDiff(diff) {
    var state = app.getState();
    app.diffForEditor(diff, state).forEach(payload => app.client.send('incoming-updates', payload));
    app.diffForBrowser(diff, state).forEach(payload => {
        chrome.tabs.sendMessage(payload.tabId, {
            action: 'apply-cssom-patch',
            data: {
                stylesheetUrl: payload.uri,
                patches: payload.patches
            }
        });
        app.dispatch({
            type: TAB.SAVE_PATCHES,
            id: payload.tabId,
            uri: payload.uri,
            patches: payload.patches
        });

        logPatches(payload.tabId, payload.uri, payload.patches);
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
 * Syncronizes currently opened tab list with app storage
 */
function syncTabs() {
    chrome.tabs.query(tabsQuery, tabs => {
        var storeTabs = app.getStateValue('tabs');
        // fetch info for new tabs (e.g. ones not in store) from content script
        Promise.all(tabs.filter(tab => !storeTabs.has(tab.id)).map(fetchTabInfo))
        .then(newTabs => {
            newTabs = newTabs.reduce((out, tab) => out.set(tab.id, tab), new Map());
            var finalTabs = tabs.reduce((out, tab) => {
                if (newTabs.has(tab.id)) {
                    // this is a new tab, add its data as is
                    out.set(tab.id, newTabs.get(tab.id));
                } else if (storeTabs.has(tab.id)) {
                    // for existing tab, check if its URL was changed
                    let tabData = storeTabs.get(tab.id).url;
                    if (tabData.url !== tab.url) {
                        out.set(tab.id, {
                            origin: tabData.origin,
                            url: tab.url
                        });
                    }
                } else {
                    console.warn('Unexpected tab:', tab);
                }
                return out;
            });
            app.dispatch({type: TAB.UPDATE_LIST, tabs: finalTabs});
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
    var session = tab && tab.session state.sessions.get(tab.session.id);
    if (!session) {
        return;
    }

    var tabStylesheets = new Map();
    // the `user` zone in tab stylesheets holds local-to-global references,
    // convert them to global-to-local
    if (tab.stylesheets.user) {
        for (let [k, v] of tab.stylesheets.user) {
            tabStylesheets.set(v, k);
        }
    }

    var items = {};
    for (let userStylesheet of session.userStylesheets) {
        items[userStylesheet] = tabStylesheets.get(userStylesheet) || null;
    }

    return createUserStylesheetUrls(tabId, items)
    .then(items => new Promise(resolve => {
        chrome.tabs.sendMessage(tabId, {
            action: 'sync-user-stylesheets',
            data: {items}
        }, resp => {
            if (resp) {
                var items = Object.keys(resp).reduce((out, globalId) => out.set(resp[globalId], globalId), new Map());
                app.dispatch({
                    type: TAB.SET_STYLESHEET_DATA,
                    id: tabId,
                    items,
                    zone: 'cssom'
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
            data: {stylesheetId: emptyItems}
        }, mainFrame, resp => {
            resolve({...items, ...(resp || {})});
        });
    });
}
