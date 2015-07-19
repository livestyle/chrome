/**
 * Remote View controller: handles communication with LiveStyle app
 * regarding Remote View sessions.
 */
'use strict';

import * as client from '../lib/client-expect';

const RV_REQUEST_SESSION_URL = 'http://localhost:9001/connect';

export function checkConnection() {
	return client.send('rv-ping')
	.expect('rv-pong')
	.then(null, function(err) {
		if (isExpectError(err)) {
			var err = new Error('No connection with LiveStyle app');
			err.code = 'ERVNOCONNECTION';
			throw err;
		}
	});
}

export function getSession(localSite) {
	return client.send('rv-get-session', {localSite})
	.expect('rv-session', data => data.localSite === site)
	.then(null, function(err) {
		if (isExpectError(err)) {
			var err = new Error(`No active session for ${localSIte}`);
			err.code = 'ERVNOSESSION';
			throw err;
		}
	});
}

export function closeSession(localSite) {
	client.send('rv-close-session', {localSite});
}

export function createSession(localSite) {
	return checkConnection()
	.then(checkIdentityPermission)
	.then(getUserToken)
	.then(requestRvSession)
	.then(function(payload) {
		return client.send('rv-create-session', payload)
		.expect('rv-session', 10000, data => data.localSite === localSite)
		.then(null, function(err) {
			if (isExpectError(err)) {
				err = new Error('No response from LiveStyle app. Make sure it’s running');
			}
			err.code = 'ERVCREATESESSION';
			throw err;
		});
	});
}

/**
 * Event router for Remote View messages
 */
export function router(message, sender, callback) {
	if (!message) {
		return;
	}

	var data = message.data;
	switch (message.name) {
		case 'rv-check-connection':
			checkConnection()
			.then(() => callback({connected: true}), () => callback({connected: false}));
			return true;
		case 'rv-get-session':
			getSession(data.localSite)
			.then(callback, err => callback({error: err ? err.message : 'Unable to get RV session'}));
			return true;
		case 'rv-create-session':
			getSession(data.localSite)
			.then(callback, err => callback({error: err ? err.message : 'Unable to create RV session'}));
			return true;
		case 'rv-close-session':
			closeSession(data.localSite);
			break;
	}
}

/**
 * Check if user granted `identity` permission for current extension.
 * `identity` permission allows fetching user token
 */
function checkIdentityPermission() {
	return new Promise(function(resolve, reject) {
		var payload = {
			permissions: ['identity']
		};

		chrome.permissions.contains(payload, function(result) {
			if (result) {
				return resolve();
			}

			// no permission to user identity, request it
			chrome.permission.request(payload, function(granted) {
				if (granted) {
					resolve();
				} else {
					var err = new Error('User rejected identity permission');
					err.code = 'ERVIDENTITYPERM';
					reject(err);
				}
			});
		});
	});
}

function getUserToken(localSite, oldToken) {
	return new Promise(function(resolve, reject) {
		var getToken = function() {
			chrome.identity.getAuthToken({interactive: true}, function(token) {
				if (chrome.runtime.lastError) {
					var err = new Error(`Unable to fetch auth token: ${chrome.runtime.lastError.message}`);
					err.code = 'ERVTOKEN';
					return reject(err);
				}

				resolve({localSite, token, retry: !!oldToken});
			});
		};

		if (oldToken) {
			chrome.identity.removeCachedAuthToken({token: oldToken}, getToken);
		} else {
			getToken();
		}
	});
}

function requestRvSession(payload) {
	return fetch(RV_REQUEST_SESSION_URL, {
		method: 'POST',
		headers: {
			Authorization: 'google ' + payload.token
		}
	})
	.then(function(res) {
		if (res.ok) {
			return res.json();
		}
		
		if (res.status === 401 && !payload.retry) {
			// unauthorized request, might be because of expired token
			return getUserToken(payload.localSite, payload.token)
			.then(requestRvSession);
		}

		// unable to handle this response, fail with JSON data
		return res.json().then(Promise.reject);
	})
	.then(null, function(err) {
		var message = null;
		if (err instanceof Error) {
			message = err.message;
		} else if (typeof err === 'object' && 'error' in err) {
			message = err.error;
		} else {
			message = 'Unable to create RV session';
		}

		err = new Error(message);
		err.code = 'ERVSESSION';
		throw err;
	});
}

function isExpectError(err) {
	return err && err.code === 'EEXPECTTIMEOUT';
}