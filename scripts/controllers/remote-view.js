/**
 * Remote View controller: handles communication with LiveStyle app
 * regarding Remote View sessions.
 */
'use strict';

import * as client from '../lib/client-expect';

const RV_REQUEST_SESSION_URL = 'http://livestyle.io:9000/connect/';

export function checkConnection() {
	return client.send('rv-ping')
	.expect('rv-pong')
	.then(null, function(err) {
		if (isExpectError(err)) {
			err = new Error('No connection with LiveStyle app');
			err.code = 'ERVNOCONNECTION';
		}
		throw err;
	});
}

export function getSession(localSite) {
	return checkConnection()
	.then(function() {
		console.log('connection is active, get session for', localSite);
		return client.send('rv-get-session', {localSite})
		.expect('rv-session', data => data.localSite === localSite);
	})
	.then(null, function(err) {
		if (isExpectError(err)) {
			err = new Error(`No active session for ${localSIte}`);
			err.code = 'ERVNOSESSION';
		}
		throw err;
	});
}

export function closeSession(localSite) {
	client.send('rv-close-session', {localSite});
}

export function createSession(localSite) {
	return getSession(localSite)
	.then(function(resp) {
		if (resp.error) {
			// no valid session, create it
			return getUserToken(localSite)
			.then(requestRvSession)
			.then(function(payload) {
				return client.send('rv-create-session', payload)
				.expect('rv-session', 15000, data => data.localSite === localSite);
			});
		}
	});
}

/**
 * Event router for Remote View messages
 */
export function router(message, sender, callback) {
	var data = message.data;
	var errResponse = function(err) {
		callback(errorJSON(err));
	};

	switch (message.name) {
		case 'rv-check-connection':
			checkConnection()
			.then(() => callback({connected: true}), () => callback({connected: false}));
			return true;
		case 'rv-get-session':
			getSession(data.localSite)
			.then(callback, errResponse);
			return true;
		case 'rv-create-session':
			createSession(data.localSite)
			.then(callback, errResponse);
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
			chrome.permissions.request(payload, function(granted) {
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
	var errMessage = 'Unable to create session, Remote View server is not available. Please try again later.';

	return fetch(RV_REQUEST_SESSION_URL, {
		method: 'POST',
		headers: {
			Authorization: 'google ' + payload.token,
			Accept: 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			localSite: payload.localSite
		})
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
		return res.json()
		.then(function(data) {
			var err = new Error(data && data.error ? data.error.message : errMessage);
			err.code = res.status;
			throw err;
		});
	}, function() {
		var err = new Error(errMessage);
		err.code = 'ERVSESSION';
		throw err;
	});
}

function isExpectError(err) {
	return err && err.code === 'EEXPECTTIMEOUT';
}

function errorJSON(err) {
	var json = {};
	if (err instanceof Error) {
		json.error = err.message;
		if (err.code) {
			json.errorCode = err.code;
		}
	} else if (typeof err === 'string') {
		json.error = err;
	} else if (err && typeof err === object) {
		json.error = err.error;
	}

	if (!json.error) {
		json.error = 'Unknown error format';
	}

	return json;
}