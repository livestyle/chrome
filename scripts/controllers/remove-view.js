/**
 * Remote View controller: handles communication with LiveStyle app
 * regarding Remote View sessions.
 */
'use strict';

import * as client from '../lib/client-expect';

const RV_REQUEST_SESSION_URL = 'http://localhost:9001/connect';

export function checkConnection() {
	return client.send('rv-ping').expect('rv-pong', 1000);
}

export function getSession(localSite) {
	return client.send('rv-get-session', {localSite})
	.expect('rv-session', data => data.localSite === site);
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
		.expect('rv-session', data => data.localSite === localSite);
	});
}

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
					err.code = 'EIDENTITYPERM';
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
					return reject(chrome.runtime.lastError);
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
	});
}