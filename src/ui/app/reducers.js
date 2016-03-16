'use strict';

import {combineReducers} from 'redux';
import {MODEL, UI, REMOTE_VIEW} from './action-names';
import {PAGE} from '../../app/action-names';
import {replaceValue} from '../../lib/utils';

export default combineReducers({model, ui});

function enabled(state=false, action) {
    if (action.type === PAGE.TOGGLE_ENABLED) {
        state = !state;
    }
    return state;
}

function model(state={}, action) {
    // since model is generated automatically from host store,
    // most model actions will modify host store (see store.js), which in turn
    // will dispatch updated popup model. But for local development we will
    // modify local model
    switch (action.type) {
        case MODEL.UPDATE:
            return action.model;

        case PAGE.TOGGLE_ENABLED:
            return {
                ...state,
                enabled: state.enabled
            };

        case PAGE.UPDATE_FILE_MAPPING:
            return {
                ...state,
                mapping: {
                    ...state.mapping,
                    [action.browser]: action.editor
                }
            };

        case PAGE.UPDATE_DIRECTION:
            return {
                ...state,
                direction: action.direction
            };
    }

    return state;
}

function ui(state={}, action) {
    var remoteView = state.remoteView || {};
    switch (action.type) {
        case UI.TOGGLE_ACTIVE_PICKER:
            return replaceValue(state, 'activePicker', action.picker ? action.picker : null);

        case UI.RESET_ACTIVE_PICKER:
            if (state.activePicker) {
                state = replaceValue(state, 'activePicker', null);
            }
            break;

        case REMOTE_VIEW.SET_TRANSITION:
            if (remoteView.transition !== action.transition) {
                state = replaceValue(state, 'remoteView.transition', action.transition);
            }
            break;

        case REMOTE_VIEW.SET_DESCRIPTION_STATE:
            if (remoteView.descriptionState !== action.state) {
                state = replaceValue(state, 'remoteView.descriptionState', action.state);
                // reset transition as well
                state.remoteView.transition = null;
            }
            break;

        case REMOTE_VIEW.PUSH_MESSAGE:
            if (remoteView.messages[remoteView.messages.length - 1] !== action.message) {
                let messages = remoteView.messages.slice();
                messages.push(action.message);
                state = replaceValue(state, 'remoteView.messages', messages);
                if (action.transition) {
                    state.remoteView.transition = action.transition;
                }
            }
            break;

        case REMOTE_VIEW.SHIFT_MESSAGE:
            if (remoteView.messages.length > 1) {
                state = replaceValue(state, 'remoteView.messages', remoteView.messages.slice(1));
                if (action.transition) {
                    state.remoteView.transition = action.transition;
                }
            }
            break;
    }

    return state;
}
