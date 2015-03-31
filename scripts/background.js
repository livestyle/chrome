import client from 'livestyle-client';
import patcher from 'livestyle-patcher';

import EventEmitter from './lib/event-emitter';
import editorController from './controllers/editor';
import errorStateTracker from './controllers/error-tracker';
import * as modelController from './controllers/model';
import * as devtoolsController from './controllers/devtools';
import * as iconController from './controllers/browser-action-icon';
import * as errorLogger from './controllers/error-logger';
import * as userStylesheets from './helpers/user-stylesheets';
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


function applyDiff(data) {
	if (!data.patches || !data.patches.length) {
		return;
	}

	modelController.active(function(models) {
		models.forEach(function(item) {
			var uri = data.uri;
			var model = item.model;
			var assocs = model.associations();
			var user = model.get('userStylesheets');
			var userTransposed = {};
			Object.keys(user).forEach(key => userTransposed[user[key]] = key);

			if (userTransposed[uri]) {
				uri = userTransposed[uri];
			}

			if (uri in assocs) {
				// This diff result is for browser file, meaning that browser
				// file was updated and editor should receive these changes
				
				// XXX send two 'incoming-updates' messages in case if updates 
				// are coming from DevTools, e.g. user updates local stylesheet 
				// then send it to all connected clients to update accordingly
				client.send('incoming-updates', {
					uri: uri,
					patches: data.patches
				});

				if (model.get('updateDirection') !== 'to browser') {
					client.send('incoming-updates', {
						uri: assocs[uri],
						patches: data.patches
					});
				}
				return;
			}

			// Looks like this diff result is coming from editor file:
			// find corresponding browser file and patch it
			var stylesheetUrl = null;
			Object.keys(assocs).some(function(key) {
				if (assocs[key] === uri) {
					return stylesheetUrl = key;
				}
			});

			if (stylesheetUrl in user) {
				stylesheetUrl = user[stylesheetUrl];
			}

			if (stylesheetUrl) {
				if (model.get('updateDirection') !== 'to editor') {
					logPatches(stylesheetUrl, data.patches);
					chrome.tabs.sendMessage(item.tab.id, {
						name: 'apply-cssom-patch',
						data: {
							stylesheetUrl: stylesheetUrl,
							patches: data.patches
						}
					});
					devtoolsController.saveDiff(item.tab.id, stylesheetUrl, data.patches);
				}
				client.send('incoming-updates', {
					uri: stylesheetUrl,
					patches: data.patches
				});
			}
		});
	});
}

function logPatches(prefix, patches) {
	console.groupCollapsed('apply diff on', prefix);
	patches.forEach(function(p) {
		console.log(utils.stringifyPatch(p));
	});
	console.groupEnd();
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

chrome.runtime.onMessage.addListener(function(message) {
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
	}
});

// when tab is loaded, request unsaved changes for loaded
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
.connect();