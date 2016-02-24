'use strict';

import {dispatch, subscribe, subscribeDeepKey, getState, getStateValue} from './store';
import autoMap from '../lib/auto-map';
import * as devtools from '../lib/devtools-resources';
import syncSessions from './sync-sessions';
import updateBrowserIcon from './browser-icon';
import updatePopups from './popup';
import {SESSION, EDITOR} from './action-names';

export {dispatch, subscribe, subscribeDeepKey, getState, getStateValue};

// Sync initial sessions
syncSessions();

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
var curSessions = new Set();
subscribe(nextSessions => {
    var tabIds = Object.keys(nextSessions);
    var toUpdate = tabIds.filter(tabId => !curSessions.has(tabId));
    curSessions = new Set(tabIds);
    toUpdate.forEach(tabId => {
        fetchCSSOMStylesheets(tabId);
        fetchDevtoolsStylesheets(tabId);
    });
}, 'sessions');

// Update browser-to-editor file mappings if either session `stylesheets`
// or `editorFiles` were updated
subscribeDeepKey('sessions', 'stylesheets', (session, tabId) => {
    updateAutoMapping(tabId, session.stylesheets, getStateValue('editorFiles'));
});

subscribe(files => {
    var sessions = getStateValue('sessions');
    Object.keys(sessions).forEach(tabId => {
        updateAutoMapping(tabId, sessions[tabId].stylesheets, files);
    });
}, 'editorFiles');

// When user or LiveStyle updated file mappings, calculate final list
subscribeDeepKey('pages', 'userMapping', (page, url) => {
    var sessions = getStateValue('sessions');
    var editorFiles = getStateValue('editorFiles');
    Object.keys(sessions).forEach(tabId => {
        if (sessions[tabId].page === url) {
            updateMapping(tabId, page.userMapping, sessions[tabId].stylesheets, editorFiles);
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

// When a list of DevTools resources is updated, update sessions stylesheets
devtools.on('list-update', () => Object.keys(getStateValue('sessions')).forEach(fetchDevtoolsStylesheets));

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
