/**
 * A store reducer and a set of methods that update LiveStyle
 * sessions list during browser lifecycle and store updates
 */
'use strict';
import deepequal from 'deep-equal';
import condense from 'condense-patches';
import {SESSION} from '../action-names';

const EMPTY_ARRAY = [];

export default function(state={}, action) {
    switch (action.type) {
        case SESSION.UPDATE_LIST:
            if (state !== action.sessions) {
                state = action.sessions;
            }
            break;

        case SESSION.SET_CSSOM_STYLESHEETS:
            return setCSSOMStylesheets(state, action);

        case SESSION.SET_DEVTOOLS_STYLESHEETS:
            return setDevToolsStylesheets(state, action);

        case SESSION.SET_USER_STYLESHEETS:
            return setUserStylesheets(state, action);

        case SESSION.UPDATE_DEVTOOLS_STYLESHEET:
            return updateDevToolsStylesheet(state, action);

        case SESSION.SAVE_RESOURCE_PATCHES:
            return saveResourcePatches(state, action);

        case SESSION.RESET_RESOURCE_PATCHES:
            return resetResourcePatches(state, action);

        case SESSION.ADD_REQUESTED_UNSAVED_FILES:
            return addRequestedUnsavedFiles(state, action);
    }

    return state;
};

function setCSSOMStylesheets(state, action) {
    var session = state[action.tabId];
    if (session && !deepequal(action.items, session.cssomStylesheets)) {
        state = {
            ...state,
            [action.tabId]: updateStylesheetsIfNeeded({
                ...session,
                cssomStylesheets: action.items
            })
        };
    }

    return state;
}

function setDevToolsStylesheets(state, action) {
    var session = state[action.tabId];
    if (session) {
        state = {
            ...state,
            [action.tabId]: updateStylesheetsIfNeeded({
                ...session,
                devtoolsStylesheets: action.items
            })
        };
    }

    return state;
}

function setUserStylesheets(state, action) {
    var session = state[action.tabId];
    if (session) {
        state = {
            ...state,
            [action.tabId]: updateStylesheetsIfNeeded({
                ...session,
                userStylesheets: action.items
            })
        };
    }

    return state;
}

function updateDevToolsStylesheet(state, action) {
    var session = state[action.tabId];
    if (session) {
        state = {
            ...state,
            [action.tabId]: updateStylesheetsIfNeeded({
                ...session,
                devtoolsStylesheets: new Map(session.devtoolsStylesheets).set(action.url, action.content)
            })
        };
    }

    return state;
}

function updateStylesheetsIfNeeded(session, action) {
    var allStylesheets = getStylesheets(session);
    if (!deepequal(allStylesheets, session.stylesheets)) {
        session.stylesheets = allStylesheets;
    }
    return session;
}

function saveResourcePatches(state, action) {
    var session = state[action.tabId];
    if (session && action.uri && action.patches.length) {
        let patches = new Map(session.patches);
        let prevValues = patches.get(action.uri) || [];
        let newValues = condense(prevValues.concat(action.patches));
        if (newValues) {
            patches.set(action.uri, newValues);
        } else {
            patches.delete(action.uri);
        }

        state = {
            ...state,
            [action.tabId]: {...session, patches}
        };
    }
    return state;
}

function resetResourcePatches(state, action) {
    var session = state[action.tabId];
    if (session && session.patches.has(action.uri)) {
        let patches = new Map(session.patches);
        patches.delete(action.uri);

        state = {
            ...state,
            [action.tabId]: {...session, patches}
        };
    }
    return state;
}

function getStylesheets(session) {
    var all = EMPTY_ARRAY.concat(
        session.cssomStylesheets || EMPTY_ARRAY,
        session.devtoolsStylesheets ? Array.from(session.devtoolsStylesheets.keys()) : EMPTY_ARRAY,
        session.userStylesheets ? Array.from(session.userStylesheets.values()) : EMPTY_ARRAY
    ).filter(Boolean);
    return Array.from(new Set(all)).sort();
}

function addRequestedUnsavedFiles(state, action) {
    var session = state[action.tabId];
    if (session) {
        var requestedUnsavedFiles = new Set(session.requestedUnsavedFiles || []);
        action.files.forEach(file => requestedUnsavedFiles.add(file));

        state = {
            ...state,
            [action.tabId]: {...session, requestedUnsavedFiles}
        };
    }
    return state;
}
