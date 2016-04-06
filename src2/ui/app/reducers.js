'use strict';

import {combineReducers} from 'redux';
import {deepSet} from 'extension-app/lib/utils';
import {MODEL, UI} from './action-names';
import {last} from '../utils';
import {PAGE, REMOTE_VIEW} from '../../app/action-names';

const combined = combineReducers({model, ui});

export default function(state={}, action) {
    state = combined(state, action);
    if (action.type === MODEL.UPDATE) {
        // when overall model is updated, set Remote View UI according to
        // session data
        var uiProps = ui(state.ui, {
            type: UI.RV_PUSH_MESSAGE,
            message: getRemoteViewUIMessage(action.model)
        });
        if (uiProps !== state.ui) {
            state = {...state, ui: uiProps};
        }
    }
    return state;
};

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
            return deepSet(state, 'enabled', action.enabled);

        case PAGE.UPDATE_FILE_MAPPING:
            return deepSet(state, 'mapping.' + action.browser, action.editor);

        case PAGE.UPDATE_DIRECTION:
            return deepSet(state, 'direction', action.direction);
    }

    return state;
}

function ui(state={}, action) {
    var remoteView = state.remoteView || {};

    switch (action.type) {
        case UI.TOGGLE_ACTIVE_PICKER:
            return deepSet(state, 'activePicker', action.picker ? action.picker : null);

        case UI.RESET_ACTIVE_PICKER:
            if (state.activePicker) {
                state = deepSet(state, 'activePicker', null);
            }
            break;

        case UI.RV_EXPAND_DESCRIPTION:
        case UI.RV_COLLAPSE_DESCRIPTION:
            if (!remoteView.transition) {
                let transition = action.type === UI.RV_EXPAND_DESCRIPTION
                    ? UI.T_EXPAND_DESCRITION
                    : UI.T_COLLAPSE_DESCRITION;
                state = deepSet(state, 'remoteView.transition', transition);
            }
            break;

        case UI.RV_DESCRIPTION_TRANSITION_COMPLETE:
            state = deepSet(state, 'remoteView.descriptionState',
                remoteView.descriptionState === 'expanded' ? 'collapsed' : 'expanded');
            state.remoteView.transition = null;
            break;

        case UI.RV_PUSH_MESSAGE:
            if (getRemoteViewMessageName(last(remoteView.messages)) !== getRemoteViewMessageName(action.message)) {
                let messages = remoteView.messages.slice();
                messages.push(action.message);
                state = deepSet(state, 'remoteView.messages', messages);
                if (!state.remoteView.transition && messages.length > 1) {
                    state.remoteView.transition = UI.T_SWAP_MESSAGE;
                }
            }
            break;

        case UI.RV_SHIFT_MESSAGE:
            if (remoteView.messages.length > 1) {
                state = deepSet(state, 'remoteView.messages', remoteView.messages.slice(1));
                if (state.remoteView.transition === UI.T_SWAP_MESSAGE) {
                    state.remoteView.transition = UI.T_SWAP_MESSAGE_COMPLETE;
                }
            }
            break;

        case UI.RV_SWAP_MESSAGE_COMPLETE:
            return deepSet(state, 'remoteView.transition',
                remoteView.messages.length > 1 ? UI.T_SWAP_MESSAGE : null);
    }

    return state;
}

/**
 * Returns message for Remote View UI that describes given Remote View session
 * state
 * @param  {Object} session Remote View session data
 * @return {String|Object}
 */
function getRemoteViewUIMessage(model) {
    var session = model.remoteView || {};
    switch (session.state) {
        case REMOTE_VIEW.STATE_PENDING:
            return 'connecting';

        case REMOTE_VIEW.STATE_CONNECTED:
            // for connected state, push session data as message. In this case,
            // when user closes manually connection, we’ll still have session
            // data for message swapping while session itself will be disposed.
            return {
                name: REMOTE_VIEW.STATE_CONNECTED,
                origin: model.origin,
                localUrl: createLocalUrl(model.origin, model.url),
                publicUrl: `http://${session.publicId}`,
                publicId: session.publicId
            };

        case REMOTE_VIEW.STATE_ERROR:
            return {
                name: 'error',
                code: session.error.code,
                message: session.error.message
            };
    }

    return 'default';
}

/**
 * Creates a local URL of given page URL for easier UX management.
 * Mostly used for `file:` origins: creates a fake URL that relative to given
 * origin. This fake URL is easier to parse and replace host name with RV domain
 * @param  {String} origin
 * @param  {String} pageUrl
 * @return {String}
 */
function createLocalUrl(origin, pageUrl) {
	var url = pageUrl;
	if (/^file:/.test(pageUrl) && pageUrl.indexOf(origin) === 0) {
		url = 'http://livestyle/' + pageUrl.slice(origin.length)
		.split(/[\\\/]/g)
		.filter(Boolean)
		.join('/');
	}
	return url;
}

function getRemoteViewMessageName(name) {
    return typeof name === 'object' ? name.name : name;
}
