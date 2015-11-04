'use strict';

import client from 'livestyle-client';
import patcher from 'livestyle-patcher';

import EventEmitter from './lib/event-emitter';
import editorController from './controllers/editor';
import errorStateTracker from './controllers/error-tracker';
import * as modelController from './controllers/model';
import * as devtoolsController from './controllers/devtools';
import * as iconController from './controllers/browser-action-icon';
import * as errorLogger from './controllers/error-logger';
import {router as rvRouter} from './controllers/remote-view';
import * as userStylesheets from './helpers/user-stylesheets';
import getStylesheetContent from './helpers/get-stylesheet-content';
import * as utils from './lib/utils';

var workerCommandQueue = patcher(client, {
	worker: './scripts/worker.js'
});

/**
 * Returns model for currently opened page
 */
export function getCurrentModel(callback) {
	modelController.current(callback);
}

export function hasErrors() {
	return !!errorLogger.getLog().length;
}

export function log(message) {
	console.log('%c[Content]', 'background:#e67e22;color:#fff', message);
}

/**
 * Check if there’s active connection to editor
 * @return {Boolean}
 */
export function isActive() {
	return editorController.get('active');
}

export function hasOpenedDevTools(tabId) {
	return devtoolsController.isOpenedForTab(tabId);
}

export function updateIconState() {
	iconController.update();
}

export {editorController, errorStateTracker};

/**
 * Returns URI of associated editor file of given model for given 
 * browser URI.
 * @param  {LivestyleModel} model
 * @param  {String} uri Editor URI
 * @return {String}     Matched browser URL
 */
function matchedEditorUri(model, uri) {
	// maybe this URI matches user stylesheet?
	var user = model.get('userStylesheets');
	uri = Object.keys(user).reduce((prev, key) => user[key] === uri ? key : prev, uri);
	return model.associations()[uri];
}

/**
 * Returns URI of associated browser file of given model for given 
 * editor URI.
 * @param  {LivestyleModel} model
 * @param  {String} uri Editor URI
 * @return {String}     Matched browser URL
 */
function matchedBrowserUri(model, uri) {
	var assocs = model.associations();
	var browserUri = null;
	Object.keys(assocs).some(function(key) {
		if (assocs[key] === uri) {
			return browserUri = key;
		}
	});

	var user = model.get('userStylesheets');
	if (browserUri in user) {
		browserUri = user[browserUri];
	}

	return browserUri;
}

function handleDiffForPage(page, data) {
	var editorUri  = matchedEditorUri(page.model, data.uri);
	var browserUri = matchedBrowserUri(page.model, data.uri);
	if (editorUri) {
		// This diff result is for browser file, meaning that browser
		// file was updated and editor should receive these changes.
		
		// XXX send two 'incoming-updates' messages in case if updates 
		// are coming from DevTools, e.g. user updates local stylesheet 
		// then send it to all connected clients to update accordingly
		client.send('incoming-updates', {
			uri: data.uri,
			patches: data.patches
		});

		if (page.model.get('updateDirection') !== 'to browser') {
			client.send('incoming-updates', {
				uri: editorUri,
				patches: data.patches
			});
		}
	} else if (browserUri) {
		// Looks like this diff result is coming from editor file:
		// patch corresponding browser file
		client.send('incoming-updates', {
			uri: browserUri,
			patches: data.patches
		});

		if (page.model.get('updateDirection') !== 'to editor') {
			logPatches(browserUri, data.patches);
			chrome.tabs.sendMessage(page.tab.id, {
				name: 'apply-cssom-patch',
				data: {
					stylesheetUrl: browserUri,
					patches: data.patches
				}
			});
			devtoolsController.saveDiff(page.tab.id, browserUri, data.patches);
		}
	}
}

function applyDiff(data) {
	if (!data.patches || !data.patches.length) {
		return;
	}

	modelController.active(pages => {
		pages.forEach(page => handleDiffForPage(page, data));
	});
}

function logPatches(prefix, patches) {
	console.groupCollapsed('apply diff on', prefix);
	patches.forEach(function(p) {
		console.log(utils.stringifyPatch(p));
	});
	console.groupEnd();
}

function identify() {
	client.send('client-id', {id: 'chrome'});
}

self.LiveStyle = utils.extend({
	/**
	 * Returns model for currently opened page
	 */
	getCurrentModel: function(callback) {
		modelController.current(callback);
	},

	hasErrors: function() {
		return !!errorLogger.getLog().length;
	},

	log: function(message) {
		console.log('%c[Content]', 'background:#e67e22;color:#fff', message);
	},

	/**
	 * Check if there’s active connection to editor
	 * @return {Boolean}
	 */
	isActive: function() {
		return editorController.get('active');
	},

	hasOpenedDevTools: function(tabId) {
		return devtoolsController.isOpenedForTab(tabId);
	},

	editorController: editorController,
	errorStateTracker: errorStateTracker.watch(workerCommandQueue),
	updateIconState: iconController.update
}, EventEmitter.prototype);

errorLogger.watch(workerCommandQueue);
errorStateTracker.watch(workerCommandQueue);
// setup browser action icon state update on error
iconController.watchErrors(errorStateTracker);

// event router
chrome.runtime.onMessage.addListener(rvRouter);
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	switch (message.name) {
		case 'add-user-stylesheet':
			modelController.current(function(model, tab) {
				var stylesheets = utils.copy(model.get('userStylesheets'));
				var maxId = 0;
				Object.keys(stylesheets).forEach(function(url) {
					var id = userStylesheets.is(url);
					if (id && +id > maxId) {
						maxId = +id;
					}
				});

				var newStylesheet = 'livestyle:' + (maxId + 1);
				console.log('Add user stylesheet %c%s', 'font-weight:bold', newStylesheet);
				userStylesheets.create(tab.id, newStylesheet, function(data) {
					stylesheets[newStylesheet] = data[newStylesheet] || '';
					model.set('userStylesheets', stylesheets);
				});
			});
			break;

		case 'remove-user-stylesheet':
			var url = message.data.url;
			console.log('Remove user stylesheet %c%s', 'font-weight:bold', url);
			modelController.current(function(model, tab) {
				var stylesheets = utils.copy(model.get('userStylesheets'));
				var assocs = utils.copy(model.get('assocs'));
				delete stylesheets[url];
				delete assocs[url];

				model.set({
					userStylesheets: stylesheets,
					assocs: assocs
				});
				userStylesheets.remove(tab.id, url);
			});
			break;

		case 'get-stylesheet-content':
			getStylesheetContent(message.data.url, sender.tab && sender.tab.id, sendResponse);
			return true;
	}
});

// when tab is loaded, request unsaved changes
chrome.tabs.onUpdated.addListener(function(id, changeInfo, tab) {
	if (changeInfo.status === 'loading') {
		devtoolsController.reset(id);
	}

	if (changeInfo.status === 'complete') {
		modelController.destroy(tab);
		modelController.get(tab, function(model) {
			var assocs = model.associations();
			var editorFiles = utils.unique(Object.keys(assocs)
				.map(key => assocs[key])
				.filter(Boolean));

			if (editorFiles.length) {
				client.send('request-unsaved-changes', {
					files: editorFiles
				});
			}
		});
	}
});

workerCommandQueue.worker.addEventListener('message', function(message) {
	var payload = message.data;
	if (payload.name === 'init') {
		return console.log('%c%s', 'color:green;font-size:1.1em;font-weight:bold;', payload.data);
	}

	if (payload.status === 'error') {
		console.error(payload.data);
	}
});

client
.on('message-send', function(name, data) {
	console.log('send socket message %c%s', 'font-weight:bold', name);
	if (name === 'diff') {
		// sending `diff` message from worker: 
		// server won’t send it back to sender so handle it manually
		applyDiff(data);
	}
})
.on('diff', function(data) {
	applyDiff(data);
})
.on('open identify-client', identify)
.connect();