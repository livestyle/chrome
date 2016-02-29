'use strict';
import client from 'livestyle-client';
import patcher from 'livestyle-patcher';
import deepmerge from 'livestyle-patcher';
import {stringifyPatch, throttle, error} from './lib/utils';
import autoMap from './lib/auto-map';
import {dispatch, subscribe, subscribeDeepKey, getState, getStateValue} from './app/store';
import {forEditor, forBrowser} from './app/diff';
import {STATE, EDITOR, SESSION} from './app/action-names';
import * as devtools from './chrome/devtools-resources';
import updateDevtoolsResource from './chrome/devtools-transactions';
import syncSessions from './chrome/sessions';
import updateBrowserIcon from './chrome/browser-icon';
import updatePopups from './chrome/popup';

const workerCommandQueue = patcher(client, {worker: './worker.js'});
const CLIENT_ID = {id: 'chrome'};
const storage = chrome.storage.local;
const storageKey = 'livestyle2';
const curSessions = new Map();

// TODO import data from old storage
const saveDataToStorage = throttle(state => {
    storage.set({[storageKey]: {pages: state.pages}}, () => {
        if (chrome.runtime.lastError) {
            console.error('Unable to save LiveStyle state', chrome.runtime.lastError);
        }
    });
}, 3000);

client.on('message-send', function(name, data) {
	console.log('send socket message %c%s', 'font-weight:bold', name);
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
.on('message-receive', (name, data) => console.log('message %c%s: %o', 'font-weight:bold', name, data))
.connect();

workerCommandQueue.worker.addEventListener('message', function(message) {
	var payload = message.data;
	if (payload.name === 'init') {
		return console.log('%c%s', 'color:green;font-size:1.1em;font-weight:bold;', payload.data);
	}

	if (payload.status === 'error') {
		console.error(payload.data);
	}
});

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

// Update browser-to-editor file mappings if either session `stylesheets`
// or `editorFiles` were updated
subscribeDeepKey('sessions', 'stylesheets', (session, tabId) => {
    updateAutoMapping(tabId, session.stylesheets, getStateValue('editorFiles'));
});

subscribe(files => {
    getSessions().forEach((session, tabId) => updateAutoMapping(tabId, session.stylesheets, files));
}, 'editorFiles');

// When user or LiveStyle updated file mappings, calculate final list
subscribeDeepKey('pages', 'userMapping', (page, url) => {
    var editorFiles = getStateValue('editorFiles');
    getSessions().forEach((session, tabId) => {
        if (session.page === url) {
            updateMapping(tabId, page.userMapping, session.stylesheets, editorFiles);
        }
    });
});

subscribeDeepKey('sessions', 'autoMapping', (session, tabId) => {
    var page = getStateValue('pages')[session.page];
    if (page) {
        updateMapping(tabId, page.userMapping, session.stylesheets, getStateValue('editorFiles'));
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

// update DevTools resource when there are pending patches
subscribeDeepKey('sessions', 'patches', (session, tabId) => {
	applyDevtoolsPatches(+tabId, session.patches);
});

devtools.on('connect', (port, tabId) => {
	var session = getSessions().get(tabId);
	if (session) {
		applyDevtoolsPatches(+tabId, session.patches);
	}
})
// When a list of DevTools resources is updated, update sessions stylesheets
.on('list-update', () => getSessions().forEach((session, tabId) => fetchDevtoolsStylesheets(tabId)));

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

// TODO request unsaved changes

function identify() {
	client.send('client-id', CLIENT_ID);
}

function applyDiff(diff) {
    forEditor(diff).forEach(payload => client.send('incoming-updates', payload));
    forBrowser(diff).forEach(payload => {
        chrome.tabs.sendMessage(+payload.tabId, {
            action: 'apply-cssom-patch',
            data: {
                stylesheetUrl: payload.uri,
                patches: payload.patches
            }
        });
		dispatch({
			type: SESSION.SAVE_RESOURCE_PATCHES,
			tabId: +payload.tabId,
			uri: payload.uri,
			patches: payload.patches
		});

        logPatches(payload.uri, payload.patches);
    });
}

function applyPatch(content, patches) {
	return sendWorkerCommand('apply-patch', {
		uri: `resource${Date.now()}`, // random name to skip command optimization
		syntax: 'css',
		content,
		patches
	});
}

function applyDevtoolsPatches(tabId, patches) {
	if (devtools.isConnected(tabId)) {
		patches.forEach((patches, url) => updateDevtoolsResource(tabId, url, applyPatch))
	}
}

/**
 * Sends command to LiveStyle worker directly
 * @param  {String} name Command name
 * @param  {Object} data Command payload
 * @return {Promise}
 */
function sendWorkerCommand(name, data) {
	return new Promise((resolve, reject) => {
		workerCommandQueue.add(name, data, (status, response) => {
			status === 'error' ? reject(error('EWORKERERROR', response)) : resolve(response);
		});
	});
}

function logPatches(prefix, patches) {
	console.groupCollapsed('apply diff on', prefix);
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
    toUpdate.forEach(tabId => {
        fetchCSSOMStylesheets(tabId);
        fetchDevtoolsStylesheets(tabId);
    });
}

function fetchCSSOMStylesheets(tabId) {
    chrome.tabs.sendMessage(+tabId, {action: 'get-stylesheets'}, items => {
        dispatch({
            type: SESSION.SET_CSSOM_STYLESHEETS,
            tabId,
            items
        });
    });
}

function fetchDevtoolsStylesheets(tabId) {
    dispatch({
        type: SESSION.SET_DEVTOOLS_STYLESHEETS,
        tabId,
        items: devtools.stylesheets(tabId)
    });
}

function updateMapping(tabId, mapping, browser, editor) {
    dispatch({
        type: SESSION.UPDATE_MAPPING,
        tabId,
        mapping: getValidMappings(mapping, browser, editor)
    });
}

function updateAutoMapping(tabId, browser, editor) {
    dispatch({
        type: SESSION.UPDATE_AUTO_MAPPING,
        tabId,
        mapping: autoMap(browser, editor)
    });
}

function getValidMappings(mappings, browser, editor) {
    browser = new Set(browser);
    editor = new Set(editor);
    return Object.keys(mappings).reduce((out, key) => {
        if (browser.has(key) && editor.has(mappings[key])) {
            out[key] = mappings[key];
        }
        return out;
    }, {});
}
