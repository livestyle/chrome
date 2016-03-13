'use strict';

import {combineReducers} from 'redux';
import {MODEL, UI} from './action-names';
import {PAGE} from '../../app/action-names';

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
    switch (action.type) {
        case UI.TOGGLE_ACTIVE_PICKER:
            state = {
                ...state,
                activePicker: state.activePicker !== action.picker ? action.picker : null
            };
            break;

        case UI.RESET_ACTIVE_PICKER:
            if (state.activePicker) {
                state = {...state, activePicker: null};
            }
            break;

        case UI.SET_RV_DESCRIPTION_STATE:
            if (state.rvDescription !== action.state) {
                state = {...state, rvDescription: action.state};
            }
            break;
    }

    return state;
}
