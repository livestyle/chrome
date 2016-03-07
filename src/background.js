'use strict';
import client from 'livestyle-client';
import {stringifyPatch, throttle, objToMap, error} from './lib/utils';
import {dispatch, subscribe, subscribeDeepKey, getState, getStateValue} from './app/store';
import {forEditor, forBrowser} from './app/diff';
import {STATE, EDITOR, SESSION} from './app/action-names';
import patcher from './app/patcher';
import devtoolsUpdate from './chrome/devtools';
import syncSessions from './chrome/sessions';
import updateBrowserIcon from './chrome/browser-icon';
import updatePopups from './chrome/popup';
import getStylesheetContent from './chrome/get-stylesheet-content';

const CLIENT_ID = {id: 'chrome'};
const storage = chrome.storage.local;
const storageKey = 'livestyle2';
const curSessions = new Map();
const mainFrame = {frameId: 0};

// TODO import data from old storage
const saveDataToStorage = throttle(state => {
    storage.set({[storageKey]: {pages: state.pages}}, () => {
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
.on('editor-connect',    data => dispatch({type: EDITOR.CONNECT, ...data}))
.on('editor-disconnect', data => dispatch({type: EDITOR.DISCONNECT, ...data}))
.on('editor-files',      data => dispatch({type: EDITOR.UPDATE_FILE_LIST, ...data}))
.on('diff', applyDiff)
.on('open identify-client', identify)
.on('message-receive', (name, data) => console.log('received message %c%s: %o', 'font-weight:bold', name, data))
.connect();

// When user updates page model, re-scan all sessions
subscribe(syncSessions, 'pages');

// subscribe to Chrome lifecycle events and keep store up-to-date
['onCreated', 'onUpdated', 'onRemoved', 'onReplaced']
.forEach(key => chrome.tabs[key].addListener(syncSessions));

// Broadcast storage update to all connected popups
subscribe(updatePopups);

// Update browser icon state when sessions are updated
subscribe(updateBrowserIcon, 'sessions');

// If sessions were updated, fetch stylesheets for new ones
subscribe(updateSessions, 'sessions');

// For newly created sessions, request unsaved changes for mapped editor files
subscribeDeepKey('sessions', 'mapping', (session, tabId) => {
    var requested = session.requestedUnsavedFiles || new Set();
    var files = Object.keys(session.mapping || {})
    .map(key => session.mapping[key])
    .filter(file => !requested.has(file));

    if (files.length) {
        dispatch({type: SESSION.ADD_REQUESTED_UNSAVED_FILES, files});
        client.send('request-unsaved-changes', {files});
    }
});

// Update aggregated list of editor files when connected editor updates
subscribe(editors => {
    var allFiles = Object.keys(editors).reduce((out, id) => out.concat(editors[id].files), []);
    dispatch({
        type: EDITOR.SET_FILES,
        files: Array.from(new Set(allFiles))
    });
}, 'editors');

// When a user stylesheets updated in host page, update matched sessions as well
subscribeDeepKey('pages', 'userStylesheets', (page, url) => {
    var sessions = getStateValue('sessions');
    Object.keys(sessions)
    .filter(tabId => sessions[tabId].page === url)
    .forEach(tabId => syncUserStylesheets(+tabId, sessions[tabId], page));
});

// Save LiveStyle data to storage
subscribe(saveDataToStorage);

// Load saved data
storage.get(storageKey, data => {
	dispatch({
		type: STATE.LOAD,
		state: data[storageKey] || {}
	});
	syncSessions();
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
            type: SESSION.SAVE_RESOURCE_PATCHES,
            tabId: payload.tabId,
            uri: payload.uri,
            patches: payload.patches
        });

        logPatches(+payload.tabId, payload.uri, payload.patches);
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

function updateSessions(nextSessions) {
	var tabIds = Object.keys(nextSessions).map(tabId => +tabId);
    var toUpdate = tabIds.filter(tabId => !curSessions.has(tabId));
	curSessions.clear();
	tabIds.forEach(tabId => curSessions.set(tabId, nextSessions[tabId]));

    var pages = getStateValue('pages');
    toUpdate.forEach(tabId => {
        var session = nextSessions[tabId];
        fetchCSSOMStylesheets(tabId);
        syncUserStylesheets(tabId, session, pages[session.page]);
    });
}

function fetchCSSOMStylesheets(tabId) {
    // always request stylesheets from main frame
    chrome.tabs.sendMessage(+tabId, {action: 'get-stylesheets'}, mainFrame, items => {
        dispatch({
            type: SESSION.SET_CSSOM_STYLESHEETS,
            tabId,
            items
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
                    items: objToMap(resp)
                });
            }
            resolve(resp);
        });
    }));
}

/**
 * Creates local URLs for new user stylesheets (e.g. `items` with empty values)
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
``
