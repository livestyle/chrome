/**
 * Creates and destroys Remote View sessions in Chrome
 */
'use strict';

import app from '../lib/app';
import {error} from '../lib/utils';

export function startSession(origin) {
    if (app.getStateValue('removeView.sessions').has(origin)) {
        // session already exists
        return;
    }

    validateOrigin(origin)
	.then(origin => {
        return app.createRemoteViewSession({
            origin,
            delegate(start, data) {
                let startSession = token => start({
                    ...data,
                    authorization: 'google ' + token
                });

                return getAuthToken()
                .then(token => {
                    return startSession(token)
                    .catch(err => {
                        if (err.code === 401) {
                            // looks like an expired token, get new one and try again
                            return resetAuthToken(token)
                            .then(getAuthToken)
                            .then(startSession);
                        }

                        return Promise.reject(err);
                    });
                });
            }
        });
	});
}

export function stopSession(origin) {
    app.closeRemoteViewSession(origin);
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
