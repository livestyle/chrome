/**
 * Remote View controller: handles communication with LiveStyle app
 * regarding Remote View sessions. Current Remote View session list is available
 * in global store
 */
'use strict';

import client from 'livestyle-client';
import {error} from '../lib/utils';
import request from '../lib/ws-request';
import {dispatch, getStateValue} from './store';
import {REMOTE_VIEW} from './action-names';

const REQUEST_SESSION_URL = 'http://livestyle.io:9000/connect/';
const errorResetHandlers = new Map();

client
// new RV session is available
.on('rv-session', setSessionData)
// RV session was closed
.on('rv-session-closed', session => clearSessionData(session.localSite))
// Received list of currently available sessions
.on('rv-session-list', sessions => dispatch({type: REMOTE_VIEW.UPDATE_SESSION_LIST, sessions}))
.on('open client-connect client-disconnect', requestSessionList)
.on('close', () => setConnectionStatus(false));

checkConnection();

export function checkConnection() {
	return request('rv-ping')
	.expect('rv-pong')
	.then(() => setConnectionStatus(true), () => setConnectionStatus(false));
}

export function createSession(localSite) {
	return validateOrigin(localSite)
	.then(localSite => {
		if (errorResetHandlers.has(localSite)) {
			clearTimeout(errorResetHandlers.get(localSite));
			errorResetHandlers.delete(localSite);
		}
		setSessionData({state: REMOTE_VIEW.STATE_PENDING, localSite});
		return localSite;
	})
	.then(getSession)
	.then(session => {
		if (session.error) {
			// no valid session, create it
			return getUserToken(localSite)
			.then(createHTTPServerIfRequired)
			.then(requestRvSession)
			.then(payload => {
				return request('rv-create-session', payload)
				.expect('rv-session', 15000, data => data.localSite === localSite);
			});
			// if session was successfully created, its data will be updated
			// by `rv-session` event listener in client.
		}
	})
	.catch(error => {
		setSessionData({state: REMOTE_VIEW.STATE_ERROR, localSite, error});
		scheduleErrorSessionRemove(localSite);
	});
}

export function closeSession(localSite) {
	request('rv-close-session', {localSite});
}

export function getSession(localSite) {
	return checkConnection()
	.then(connected => {
		if (!connected) {
			return Promise.reject(error('ENOAPP', 'No connection to LiveStyle app. It is running?'))
		}

		console.log('connection is active, get session for', localSite);
		return request('rv-get-session', {localSite})
		.expect('rv-session', data => data.localSite === localSite);
	})
	.catch(err => {
		if (isExpectError(err)) {
			err = error('ERVNOSESSION', `No active session for ${localSite}`);
		}
		return Promise.reject(err);
	});
}

export function validateOrigin(url) {
	if (!url) {
		return Promise.reject(error('ERVNOORIGIN', 'Local site origin is empty'));
	}

	if (!/^(https?|file):/.test(url)) {
		return Promise.reject(error('ERVINVALIDORIGIN', 'Invalid local site origin: only HTTP(S) and FILE protocols are supported'));
	}

	return Promise.resolve(url);
}

function requestSessionList() {
	return checkConnection().then(connected => connected && request('rv-get-session-list'));
}

function setConnectionStatus(connected) {
	dispatch({type: REMOTE_VIEW.SET_STATUS, connected});
	return connected;
}

function setSessionData(session) {
	dispatch({type: REMOTE_VIEW.SET_SESSION, session});
}

function clearSessionData(localSite) {
	dispatch({type: REMOTE_VIEW.REMOVE_SESSION, localSite});
}

function scheduleErrorSessionRemove(localSite) {
	errorResetHandlers.set(localSite, setTimeout(() => {
		var sessions = getStateValue('remoteView').sessions;
		if (sessions && sessions.has(localSite) && sessions.get(localSite).state === REMOTE_VIEW.STATE_ERROR) {
			clearSessionData(localSite);
		}
		errorResetHandlers.delete(localSite);
	}, 5000));
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
					reject(error('ERVIDENTITYPERM', 'User rejected identity permission'));
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
					return reject(error('ERVTOKEN', `Unable to fetch auth token: ${chrome.runtime.lastError.message}`));
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

	return fetch(REQUEST_SESSION_URL, {
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
		return res.json().then(data => Promise.reject(error(res.status, data && data.error ? data.error.message : errMessage)));
	}, () => Promise.reject(error('ERVSESSION', errMessage)));
}

function createHTTPServerIfRequired(payload) {
	if (!/^file:/.test(payload.localSite)) {
		return Promise.resolve(payload);
	}

	var docroot = payload.localSite;
	console.log('create HTTP server for %s', docroot);
	return request('rv-create-http-server', {docroot})
	.expect('rv-http-server', data => data.docroot === docroot)
	.then(data => ({...payload, localSite: data.origin}));
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
