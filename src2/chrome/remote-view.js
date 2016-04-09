/**
 * Creates and destroys Remote View sessions in Chrome
 */
'use strict';

import {REMOTE_VIEW} from 'extension-app/lib/action-names';
import app from '../lib/app';
import {error} from '../lib/utils';

const errorResetHandlers = new Map();

export function createSession(tabId) {
    // check if there’s already opened session for given tab
    var tab = app.getStateValue('tabs').get(tabId);

    if (!tab) {
        return Promise.reject(error('ERVNOTAB', 'No tab for id ' + tabId));
    }

    if (tab.remoteView) {
        return Promise.resolve(app.getStateValue('remoteView.sessions').get(tab.remoteView));
    }

	return validateOrigin(tab.origin)
	.then(origin => {
		if (errorResetHandlers.has(origin)) {
			clearTimeout(errorResetHandlers.get(origin));
			errorResetHandlers.delete(origin);
		}

		setSessionData({state: REMOTE_VIEW.STATE_PENDING, localSite: origin});

        var _createSession = token => app.createRemoteViewSession({
            authorization: 'google ' + token,
            localSite: origin
        });

        return getAuthToken()
        .then(_createSession)
        .catch(err => {
            if (err.code === 401) {
                // looks like an expired token, get new one and try again
                return resetAuthToken(token)
                .then(getAuthToken)
                .then(_createSession);
            }
            return Promise.reject(err);
        });
	})
	.catch(err => {
		console.log('got RV error', err);
		setSessionData({state: REMOTE_VIEW.STATE_ERROR, localSite: tab.origin, err});
		scheduleErrorSessionRemove(tab.origin);
	});
}

export function destroySession(tabId) {
    var tab = app.getStateValue('tabs').get(tabId);
    if (tab) {
        app.destroyRemoteViewSession(tab.origin);
    }
}

function validateOrigin(origin) {
	console.log('validating origin', origin);
	if (!origin) {
		return Promise.reject(error('ERVNOORIGIN', 'Local site origin is empty'));
	}

	if (!/^(https?|file):/.test(origin)) {
		return Promise.reject(error('ERVINVALIDORIGIN', 'Invalid local site origin: only HTTP(S) and FILE protocols are supported'));
	}

	return Promise.resolve(origin);
}

function setSessionData(session) {
	app.dispatch({type: REMOTE_VIEW.SET_SESSION, session});
}

function getAuthToken() {
	return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({interactive: true}, token => {
            if (chrome.runtime.lastError) {
                reject(error('ERVTOKEN', `Unable to fetch auth token: ${chrome.runtime.lastError.message}`));
            } else {
                resolve(token);
            }
        });
	});
}

function resetAuthToken(token) {
    return new Promise(resolve => chrome.identity.removeCachedAuthToken({token}, resolve));
}
