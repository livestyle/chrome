/**
 * A store reducer and a set of methods that update LiveStyle
 * sessions list during browser lifecycle and store updates
 */
'use strict';
import deepequal from 'deep-equal';
import {SESSION} from '../action-names';

const EMPTY_ARRAY = [];
const stylesheetAction = {
    [SESSION.SET_CSSOM_STYLESHEETS]: 'cssomStylesheets',
    [SESSION.SET_DEVTOOLS_STYLESHEETS]: 'devtoolsStylesheets'
};

export default function(state={}, action) {
    let session = state[action.tabId];

    if (action.type in stylesheetAction) {
        let key = stylesheetAction[action.type];
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
                if (state !== action.sessions) {
                    state = action.sessions;
                }
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
                    // auto-mapping always contains valid file references
                    let mapping = {
                        ...session.autoMapping,
                        ...action.mapping
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

function getStylesheets(session) {
    var all = EMPTY_ARRAY.concat(
        session.cssomStylesheets || EMPTY_ARRAY,
        session.devtoolsStylesheets || EMPTY_ARRAY
    );
    return Array.from(new Set(all)).sort();
}
