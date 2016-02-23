/**
 * A store reducer and a set of methods that update LiveStyle
 * sessions list during browser lifecycle and store updates
 */
'use strict';
import deepequal from 'deep-equal';
import {SESSION} from '../action-names';
import * as devtools from '../../lib/devtools-resources';
import {normalizeUrl} from '../../lib/utils';

const EMPTY_ARRAY = [];
const actionToKey = {
    [SESSION.SET_CSSOM_STYLESHEETS]: 'cssomStylesheets',
    [SESSION.SET_DEVTOOLS_STYLESHEETS]: 'devtoolsStylesheets'
};

export default function(state={}, action) {
    let session = state[action.tabId];

    if (action.type in actionToKey) {
        let key = actionToKey[action.type];
        if (session && !deepequal(action.items, session[key])) {
            session = {
                ...session,
                [key]: action.items
            };

            var allStylesheets = getStylesheets(session);
            if (!deepequal(allStylesheets, session.stylesheets)) {
                session.stylesheets = allStylesheets;
            }

            state = {
                ...state,
                [action.tabId]: session
            };
        }
    } else {
        switch (action.type) {
            case SESSION.UPDATE_LIST:
                state = action.sessions;
                break;

            case SESSION.UPDATE_AUTO_MAPPING:
                if (session && !deepequal(session.autoMapping, action.mapping)) {
                    state = {
                        ...state,
                        [action.tabId]: {
                            ...session,
                            autoMapping: action.mapping
                        }
                    };
                }
                break;

            case SESSION.UPDATE_MAPPING:
                // calculate final mapping based on user and auto mappings
                if (session) {
                    // auto-mapping always contains valid references but user ones
                    // may contain references for files that not yet opened in
                    // editor or browser so we have to validate them first
                    let mapping = {
                        ...session.autoMapping,
                        ...getValidMappings(action.userMapping, session.stylesheets, action.editorFiles)
                    };
                    if (!deepequal(session.mapping, mapping)) {
                        state = {
                            ...state,
                            [action.tabId]: {...session, mapping}
                        };
                    }
                }
                break;
        }
    }

    return state;
};

/**
 * Updates session list to match current state of active pages model
 * @param  {Object} pages    Active page models
 * @param  {Object} sessions Current tab sessions
 * @return {Promise} A promise that resolved with updated sessions
 */
export function updateSessions(pages, sessions) {
    return new Promise(resolve => {
        chrome.tabs.query({
            windowType: 'normal',
            status: 'complete'
        }, tabs => {
            let pageUrls = new Set(Object.keys(pages));
            let currentTabIds = new Set(tabs.map(tab => tab.id));

            // check if we have to remove some sessions
            let removed = Object.keys(sessions).filter(tabId => {
                if (!currentTabIds.has(+tabId)) {
                    // tab was closed, remove session
                    return true;
                }

                var page = pages[sessions[tabId]];
                // also remove if matched page was disabled
                return !page || !page.enabled;
            });

            // check for new sessions
            let added = tabs.filter(tab => !(tab.id in sessions) && pageUrls.has(normalizeUrl(tab.url)));

            if (removed.length || added.length) {
                sessions = {...sessions};
            }

            removed.forEach(tabId => delete sessions[tabId]);
            added.forEach(tab => {
                console.log('adding session for tab', tab);
                sessions[tab.id] = {
                    page: normalizeUrl(tab.url),
                    stylesheets: [],
                    cssomStylesheets: null,
                    devtoolsStylesheets: null,
                    mapping: {},
                    autoMapping: {}
                };
            });

            resolve(sessions);
        });
    });
}

export function fetchCSSOMStylesheets(tabId) {
    return dispatch => {
        console.log('request stylesheets in tab', +tabId);
        chrome.tabs.sendMessage(+tabId, {action: 'get-stylesheets'}, items => {
            dispatch({
                type: SESSION.SET_CSSOM_STYLESHEETS,
                tabId,
                items
            });
        });
    };
}

export function fetchDevtoolsStylesheets(tabId) {
    return dispatch => {
        dispatch({
            type: SESSION.SET_DEVTOOLS_STYLESHEETS,
            tabId,
            items: devtools.stylesheets(tabId)
        });
    };
}

function getStylesheets(session) {
    var all = EMPTY_ARRAY.concat(
        session.cssomStylesheets || EMPTY_ARRAY,
        session.devtoolsStylesheets || EMPTY_ARRAY
    );
    return Array.from(new Set(all)).sort();
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
