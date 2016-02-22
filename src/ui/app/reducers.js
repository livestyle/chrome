'use strict';

import {combineReducers} from 'redux';
import {MODEL, UI} from './action-names';
import {PAGE} from '../app/action-names';

export combineReducers({model, ui});

function model(state={}, action) {
    switch (action.type) {
        case MODEL.UPDATE:
            state = action.model;
            break;
        // since model is generated automatically from host store,
        // most model actions modify host model
        case PAGE.TOGGLE_ENABLED:
        case PAGE.UPDATE_FILE_MAPPING:
        case PAGE.UPDATE_DIRECTION:
            dispatch(action);
            break;
    }

    return state;
}

function ui(state={}, action) {
    switch (action.type) {
        case UI.SET_ACTIVE_PICKER:
            state = {
                ...state,
                activePicker: state.activePicker !== action.picker ? action.picker : null
            };
            break;
        case UI.RESET_ACTIVE_PICKER:
            if (state.activePicker) {
                state = {
                    ...state,
                    activePicker: null
                };
            }
            break;
    }

    return state;
}

function dispatch(data) {
    chrome.runtime.sendMessage({action: 'dispatch', data});
}
