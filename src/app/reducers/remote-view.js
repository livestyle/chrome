/**
 * Reducers for Remote View
 */
'use strict';

import {REMOTE_VIEW} from '../action-names';

export default function(state={}, action) {
    switch (action.type) {
        case REMOTE_VIEW.SET_STATUS:
            if (state.connected !== action.connected) {
                state = {...state, connected: action.connected};
                if (!state.connected) {
                    state.sessions = new Map();
                }
            }
            break;

        case REMOTE_VIEW.SET_SESSION:
            return {
                ...state,
                sessions: addSession(new Map(state.sessions), action.session)
            };

        case REMOTE_VIEW.REMOVE_SESSION:
            state = {...state, sessions: new Map(state.sessions)};
            state.sessions.delete(action.localSite);
            break;

        case REMOTE_VIEW.UPDATE_SESSION_LIST:
            return {
                ...state,
                sessions: action.sessions.reduce(addSession, new Map())
            };
    }

    return state;
};

function addSession(map, session) {
    if (!session.state || session.state === 'idle') {
        session = {...session, state: REMOTE_VIEW.STATE_CONNECTED};
    }
    return map.set(session.localSite, session);
}
