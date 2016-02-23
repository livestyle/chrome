'use strict';

import {combineReducers} from 'redux';
import {MODEL, UI} from './action-names';
import {PAGE} from '../../app/action-names';

const isExtension = /^chrome/.test(window.location.href);
export default combineReducers({enabled, model, ui});


function enabled(state=false, action) {
    if (action.type === PAGE.TOGGLE_ENABLED) {
        if (!isExtension) {
            state = !state;
        } else {
            dispatch(action);
        }
    }
    return state;
}

function model(state={}, action) {
    switch (action.type) {
        case MODEL.UPDATE:
            state = action.model;
            break;
        // since model is generated automatically from host store,
        // most model actions should modify host store, which in turn will dispatch
        // updated popup model. But for local developing we will modify popup
        // model instead
        case PAGE.UPDATE_FILE_MAPPING:
            if (!isExtension) {
                state = {
                    ...state,
                    mapping: {
                        ...state.mapping,
                        [action.browser]: action.editor
                    }
                };
            } else {
                dispatch(action);
            }
            break;
        case PAGE.UPDATE_DIRECTION:
            if (!isExtension) {
                state = {
                    ...state,
                    direction: action.direction
                };
            } else {
                dispatch(action);
            }
            break;
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
