/**
 * Redux reducers for `pages` key
 */
'use strict';
import {PAGE} from '../action-names';

export default function(state={}, action) {
    switch (action.type) {
        case PAGE.TOGGLE_ENABLED:
            return toggleEnabled(state, action);
        case PAGE.UPDATE_FILE_MAPPING:
            return updateFileMapping(state, action);
        case PAGE.UPDATE_DIRECTION:
            return updateDirection(state, action);
        case PAGE.LAST_USED:
            return {
                ...state,
                [action.page]: {
                    ...state[action.page],
                    lastUsed: Date.now()
                }
            };
        case PAGE.ADD_USER_STYLESHEET:
            return addUserStylesheet(state, action);
        case PAGE.REMOVE_USER_STYLESHEET:
            return removeUserStylesheet(state, action);
    }

    return state;
};

function toggleEnabled(state, action) {
    var page = state[action.page];
    if (!page) {
        // create a new page model
        page = {
            enabled: false,
            direction: PAGE.DIRECTION_BOTH,
            lastUsed: Date.now(),
            userMapping: {}
        };
    }

    return {
        ...state,
        [action.page]: {...page, enabled: !page.enabled}
    };
}

function updateFileMapping(state, action) {
    var page = state[action.page];
    if (page && page.userMapping[action.browser] !== action.editor) {
        state = {
            ...state,
            [action.page]: {
                ...page,
                userMapping: {
                    ...page.userMapping,
                    [action.browser]: action.editor
                }
            }
        };
    }

    return state;
}

function updateDirection(state, action) {
    var page = state[action.page];
    if (page && page.direction !== action.direction) {
        state = {
            ...state,
            [action.page]: {
                ...page,
                direction: action.direction
            }
        };
    }

    return state;
}

function addUserStylesheet(state, action) {
    var page = state[action.page];
    if (page) {
        let userStylesheets = page.userStylesheets ? page.userStylesheets.slice(0) : [];
        userStylesheets.push(`css${Date.now()}`);
        state = {
            ...state,
            [action.page]: {...page, userStylesheets}
        };
    }

    return state;
}

function removeUserStylesheet(state, action) {
    var page = state[action.page];
    if (page && page.userStylesheets && page.userStylesheets.indexOf(action.id) !== -1) {
        let userStylesheets = page.userStylesheets.filter(id => id !== action.id);
        state = {
            ...state,
            [action.page]: {...page, userStylesheets}
        };
    }

    return state;
}
