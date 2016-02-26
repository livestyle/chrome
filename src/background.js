'use strict';
import client from 'livestyle-client';
import patcher from 'livestyle-patcher';
import {stringifyPatch} from './lib/utils';
import * as devtools from './lib/devtools-resources';
import * as app from './app';
import {forEditor, forBrowser} from './app/diff';
import updateDevtoolsResource from './app/devtools-transactions';
import {EDITOR, SESSION} from './app/action-names';

const workerCommandQueue = patcher(client, {worker: './worker.js'});
const CLIENT_ID = {id: 'chrome'};

client.on('message-send', function(name, data) {
	console.log('send socket message %c%s', 'font-weight:bold', name);
	if (name === 'diff') {
		// sending `diff` message from worker:
		// server won’t send it back to sender so handle it manually
		applyDiff(data);
	}
})
.on('editor-connect',    data => app.dispatch({type: EDITOR.CONNECT, ...data}))
.on('editor-disconnect', data => app.dispatch({type: EDITOR.DISCONNECT, ...data}))
.on('editor-files',      data => app.dispatch({type: EDITOR.UPDATE_FILE_LIST, ...data}))
.on('diff', applyDiff)
.on('open identify-client', identify)
.on('message-receive', (name, data) => console.log('message %c%s: %o', 'font-weight:bold', name, data))
.connect();

workerCommandQueue.worker.addEventListener('message', function(message) {
	var payload = message.data;
	if (payload.name === 'init') {
		return console.log('%c%s', 'color:green;font-size:1.1em;font-weight:bold;', payload.data);
	}

	if (payload.status === 'error') {
		console.error(payload.data);
	}
});

// update DevTools resource when there are pending patches
app.subscribeDeepKey('sessions', 'patches', (session, tabId) => {
	applyDevtoolsPatches(+tabId, session.patches);
});
devtools.on('connect', (port, tabId) => {
	var session = app.getStateValue('sessions')[tabId];
	if (session) {
		applyDevtoolsPatches(+tabId, session.patches);
	}
});

// TODO request unsaved changes

function identify() {
	client.send('client-id', CLIENT_ID);
}

function applyDiff(diff) {
	console.log('applying diff', diff);
    forEditor(diff).forEach(payload => client.send('incoming-updates', payload));
    forBrowser(diff).forEach(payload => {
        chrome.tabs.sendMessage(+payload.tabId, {
            action: 'apply-cssom-patch',
            data: {
                stylesheetUrl: payload.uri,
                patches: payload.patches
            }
        });
		app.dispatch({
			type: SESSION.SAVE_RESOURCE_PATCHES,
			tabId: +payload.tabId,
			uri: payload.uri,
			patches: payload.patches
		});

        logPatches(payload.uri, payload.patches);
    });
}

function applyPatch(content, patches) {
	return sendWorkerCommand('apply-patch', {
		uri: `resource${Date.now()}`, // random name to skip command optimization
		syntax: 'css',
		content,
		patches
	});
}

function applyDevtoolsPatches(tabId, patches) {
	if (devtools.isConnected(tabId)) {
		patches.forEach((patches, url) => updateDevtoolsResource(tabId, url, applyPatch))
	}
}

/**
 * Sends command to LiveStyle worker directly
 * @param  {String} name Command name
 * @param  {Object} data Command payload
 * @return {Promise}
 */
function sendWorkerCommand(name, data) {
	return new Promise((resolve, reject) => {
		workerCommandQueue.add(name, data, (status, response) => {
			if (status === 'error') {
				let err = new Error(response);
				err.code = 'EWORKERERROR';
				return reject(err);
			}
			resolve(response);
		});
	});
}

function logPatches(prefix, patches) {
	console.groupCollapsed('apply diff on', prefix);
	patches.forEach(function(p) {
		console.log(stringifyPatch(p));
	});
	console.groupEnd();
}
