'use strict';

import {dispatch, subscribe, subscribeDeepKey, getState, getStateValue} from './store';
import {updateSessions, fetchCSSOMStylesheets, fetchDevtoolsStylesheets} from './reducers/sessions';
import autoMap from '../lib/auto-map';
import * as devtools from '../lib/devtools-resources';
import {SESSION} from './action-names';

export {dispatch, subscribe, subscribeDeepKey, getState, getStateValue};

// Sync initial sessions
syncSessions();

// When user updates page model, re-scan all sessions
subscribe(syncSessions, 'pages');

// If sessions were updated, fetch stylesheets for new ones
var curSessions = new Set();
subscribe(nextSessions => {
    var tabIds = Object.keys(nextSessions);
    tabIds.forEach(tabId => {
        if (!curSessions.has(tabId)) {
            dispatch(fetchCSSOMStylesheets(tabId));
            dispatch(fetchDevtoolsStylesheets(tabId));
        }
    });
    curSessions = new Set(tabIds);
}, 'sessions');

// Update browser-to-editor file mappings if either session `stylesheets`
// or `editorFiles` were updated
subscribeDeepKey('sessions', 'stylesheets', (session, tabId) => {
    dispatch({
        type: SESSION.UPDATE_AUTO_MAPPING,
        tabId,
        mapping: autoMap(session.stylesheets, getStateValue('editorFiles'))
    });
});

subscribe(files => {
    var sessions = getStateValue('sessions');
    Object.keys(sessions).forEach(tabId => {
        dispatch({
            type: SESSION.UPDATE_AUTO_MAPPING,
            tabId,
            mapping: autoMap(sessions[tabId].stylesheets, files)
        });
    });
}, 'editorFiles');

// When user or LiveStyle updated file mappings, calculate final list
subscribeDeepKey('pages', 'userMapping', (model, page) => {
    // find all sessions for updated page
    var sessions = getStateValue('sessions');
    var editorFiles = getStateValue('editorFiles');
    Object.keys(sessions).forEach(tabId => {
        if (sessions[tabId].page === page) {
            console.info('updated user mapping');
            dispatch({
                type: SESSION.UPDATE_MAPPING,
                tabId,
                editorFiles,
                userMapping: model.userMapping
            });
        }
    });
});

subscribeDeepKey('sessions', 'autoMapping', (session, tabId) => {
    var page = getStateValue('pages')[session.page];
    if (page) {
        console.info('updated auto mapping');
        dispatch({
            type: SESSION.UPDATE_MAPPING,
            tabId,
            editorFiles: getStateValue('editorFiles'),
            userMapping: page.userMapping
        });
    }
});

// sync sessions when pages are updated
subscribe(syncSessions, 'pages');

// subscribe to Chrome lifecycle events and keep store up-to-date
chrome.tabs.onCreated.addListener(syncSessions);
chrome.tabs.onUpdated.addListener(syncSessions);
chrome.tabs.onRemoved.addListener(syncSessions);
chrome.tabs.onReplaced.addListener(syncSessions);

// When a list of DevTools resources is updated, update sessions stylesheets
devtools.on('list-update', () => {
    var sessions = getStateValue('sessions');
    Object.keys(sessions).forEach(tabId => dispatch(fetchDevtoolsStylesheets(tabId)));
});

function syncSessions() {
    var state = getState();
    updateSessions(state.pages, state.sessions).then(sessions => {
        if (sessions !== state.sessions) {
            dispatch({
                type: SESSION.UPDATE_LIST,
                sessions
            });
        }
    });
}
