/**
 * Controller for LiveStyle model: creates or restores 
 * model for given tab (page url) and automatically syncs
 * changes with storage backend.
 */
'use strict';

import client from 'livestyle-client';
import LiveStyleModel from '../lib/livestyle-model';
import editorController from './editor';
import * as devtoolsController from './devtools';
import * as userStylesheets from '../helpers/user-stylesheets';
import {copy, debounce} from '../lib/utils';

var collection = {}; // collection of all active page models
var storage = chrome.storage.local;
var dummyFn = function() {};
var debouncedSaveChanges = debounce(saveChanges, 100);
var updateTimeout = 3000; // milliseconds

/**
 * Returns model ID from given tab
 * @type {String}
 */
export {idFromTab as id};

/**
 * Returns model for given tab
 * @param  {String}   tab
 * @param  {Function} callback 
 */
export function get(tab, callback) {
	if (!tab) {
		return callback();
	}

	getModel(tab, callback);
}

/**
 * Returns list of available active models and tabs that can be used
 * for patching
 * @param {Function} callback
 */
export function active(callback) {
	chrome.tabs.query({/* highlighted: true, */ windowType: 'normal'}, function(tabs) {
		var models = [];
		var next = function() {
			if (!tabs.length) {
				return callback(models);
			}

			var tab = tabs.pop();
			getModel(tab, function(model) {
				if (model && model.get('enabled')) {
					models.push({
						tab: tab,
						model: model
					});
				}
				next();
			});
		};
		next();
	});
}

/**
 * Returns currently active tab and its model
 * @param  {Function} callback
 */
export function current(callback) {
	activeTab(function(tab) {
		get(tab, function(model) {
			callback(model, tab);
		});
	});
}

/**
 * Destroys model for given tab or id
 * @param  {Object} tab Tab or ID
 * @param {Boolean} noSave Do not save model
 */
export function destroy(tab, noSave) {
	var id = idFromTab(tab);
	if (id in collection) {
		console.log('%cDestroy model for', 'font-weight:bold;color:red', id);
		var model = collection[id];
		delete collection[id];
		if (!noSave) {
			saveChanges(model);
		}
		model.destroy();
	}
}

/**
 * Returns matching file URL from active models. 
 * The `callback` argument receives array of objects
 * with `url` and `type` ('browser' or 'editor') keys
 * @param  {String}   url      
 * @param  {Function} callback
 */
export function matchingUrl(url, callback) {
	url = idFromTab(url);
	this.active(function(models) {
		var result = [];
		models.forEach(function(model) {
			var browserFiles = model.get('browserFiles') || [];
			var editorFiles = model.get('editorFiles') || [];

			browserFiles.forEach(function(file) {
				if (file === url) {
					result.push({url: file, type: 'browser'});
				}
			});

			editorFiles.forEach(function(file) {
				if (file === url) {
					result.push({url: file, type: 'editor'});
				}
			});
		});

		callback(result);
	});
}

function eachModel(fn) {
	Object.keys(collection).forEach(function(key) {
		fn(collection[key], key);
	});
}

function idFromTab(tab) {
	var url = typeof tab === 'string' ? tab : tab.url;
	return url.split('#')[0];
}

function activeTab(callback) {
	chrome.tabs.query({currentWindow: true, highlighted: true, windowType: 'normal'}, function(tabs) {
		callback(tabs && tabs[0]);
	});
}

function getModel(tab, callback) {
	callback = callback || dummyFn;
	var id = idFromTab(tab);
	if (id in collection) {
		return updateModelIfNeeded(tab, collection[id], callback);
	}

	var model = new LiveStyleModel(id);
	collection[id] = model;
	storage.get(id, function(items) {
		items = items || {};
		if (items[id]) {
			var user = {};
			(items[id].userStylesheets || []).forEach(function(url) {
				user[url] = '';
			});
			items[id].userStylesheets = user;
			model.set(items[id]);
		} else {
			model.set({
				enabled: false,
				assocs: {},
				userStylesheets: {}
			});
		}

		updateModel(tab, model, function(model) {
			model
			.on('change:userStylesheets', handleUserStylesheetChange)
			.on('change', debouncedSaveChanges);
			callback(model);
		});
	});
}

function updateModel(tab, model, callback) {
	model.set('editorFiles', editorController.get('files'));
	model.set('url', tab.url);
	model.lastUpdate = Date.now();

	// Fetching page origin is potentially slow operation but required only once.
	// Optimize this request
	var p = model.get('origin') ? Promise.resolve(model.get('origin')) : getTabOrigin(tab);
	p.then(origin => {
		console.log('set model origin', origin);
		model.set('origin', origin || '');
		model.set('needsRefresh', false);

		var user = model.get('userStylesheets');
		userStylesheets.validate(tab.id, Object.keys(user), function(stylesheets) {
			model.set('userStylesheets', stylesheets || user);
			var saveBrowserStylesheets = function(stylesheets) {
				if (!stylesheets && chrome.runtime.lastError) {
					model.set('needsRefresh', true);
					console.error('Error while fetching list of stylesheets:', chrome.runtime.lastError.message);
					console.info('Maybe try refreshing the page?');
				} else {
					// XXX this thing looks like a hack: user stylesheets
					// are skipped from CSSOM but available in DevTools.
					// Should be a better way of precise user stylesheet detection
					stylesheets = (stylesheets || []).filter(url => !/^blob:/.test(url));
					model.set('browserFiles', stylesheets);
				}
				callback(model);
			};

			// XXX currently, if source maps are enabled, a stylesheet list from 
			// DevTools returns generates source map stylesheets as well, which
			// introduces a number of nasty issues. There’s no valid way
			// to filter those source maps stylesheets.
			// As a workaround, return list of stylesheets available from CSSOM

			// XXX lots of people uses LiveStyle with local files (e.g. 
			// file:// protocol). With CSSOM only they can’t see @import 
			// stylesheets. For now, allow DevTools stylesheet fetching
			// for file:// origins
			if (shouldGetResourcesFromDevtools(tab)) {
				devtoolsController.stylesheets(tab.id, saveBrowserStylesheets);
			} else {
				chrome.tabs.sendMessage(tab.id, {name: 'get-stylesheets'}, saveBrowserStylesheets);
			}
		});
	});
}

function updateModelIfNeeded(tab, model, callback) {
	if (model.lastUpdate + updateTimeout < Date.now()) {
		return updateModel(tab, model, callback);
	}

	callback(model);
}

function shouldGetResourcesFromDevtools(tab) {
	return devtoolsController.isOpenedForTab(tab.id) && /^(file|chrome|chrome\-extension):/.test(tab.url || '');
}

/**
 * An event listener for `userStylesheets` attribute change in model
 */
function handleUserStylesheetChange() {
	var model = this;
	activeTab(function(tab) {
		userStylesheets.validate(tab.id, Object.keys(model.get('userStylesheets')), function(data) {
			data = data || {};
			var assocs = copy(model.get('assocs'));
			Object.keys(assocs).forEach(function(browserFile) {
				if (userStylesheets.is(browserFile) && !(browserFile in data)) {
					delete assocs[browserFile];
				}
			});

			model.set({
				userStylesheets: data,
				assocs: assocs
			}, {silent: true});
		});
	});
}

function saveChanges(model) {
	var payload = {};
	var assocs = model.get('assocs') || {};
	
	// remove empty (unassociated) entries
	Object.keys(assocs).forEach(function(key) {
		if (assocs[key] == null) {
			delete assocs[key];
		}
	});

	payload[model.id] = {
		enabled: model.get('enabled'),
		assocs: assocs,
		updateDirection: model.get('updateDirection') || '',
		userStylesheets: Object.keys(model.get('userStylesheets') || {})
	};
	storage.set(payload);
}

function getTabOrigin(tab) {
	return new Promise(function(resolve, reject) {
		chrome.tabs.sendMessage(tab.id, {name: 'get-origin'}, resolve);
	});
}

/**
 * Invalidate current models: removes models that have 
 * no opened tab. This saves some memory 
 */
function invalidateModels() {
	chrome.tabs.query({windowType: 'normal'}, function(tabs) {
		var activeIds = tabs.map(idFromTab);
		Object.keys(collection).forEach(function(id) {
			if (!~activeIds.indexOf(id)) {
				destroy(id);
			}
		});
	});
}

chrome.storage.onChanged.addListener(function(changes) {
	Object.keys(changes).forEach(function(key) {
		if (key in collection) {
			collection[key].set(changes[key], {silent: true});
		}
	});
});

// setup relationships between models
editorController.on('change:files', function() {
	var files = editorController.get('files');
	eachModel(function(model, id) {
		model.set('editorFiles', files);
	});
});

editorController.connect(client);

// clean up model collection when tab is closed
chrome.tabs.onRemoved.addListener(invalidateModels);