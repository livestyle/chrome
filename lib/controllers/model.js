/**
 * Controller for LiveStyle model: creates or restores 
 * model for given tab (page url) and automatically syncs
 * changes with storage backend.
 */
define(function(require) {
	var Model = require('../model');
	var LiveStyleModel = require('../livestyle-model');
	var pageStyles = require('../helpers/page-styles');
	var client = require('../../node_modules/livestyle-client/index');
	
	var collection = {}; // collection of all active page models
	var storage = chrome.storage.local;
	var editorModel = new Model();
	var dummyFn = function() {};

	function eachModel(fn) {
		Object.keys(collection).forEach(function(key) {
			fn(collection[key], key);
		});
	}

	function createModel(id, callback) {
		callback = callback || dummyFn;
		if (id in collection) {
			return callback(collection[id]);
		}

		var model = new LiveStyleModel(id);
		collection[id] = model;
		storage.get(id, function(items) {
			items = items || {};
			if (items[id]) {
				model.set(items[id]);
			}

			model.set('editorFiles', editorModel.get('files'));
			pageStyles(id, function(styles) {
				model.set('browserFiles', styles);
				callback(model.on('change', saveChanges));
			});
		});
	}

	function saveChanges(model) {
		var payload = {};
		payload[model.id] = {
			enabled: model.get('enabled'),
			assocs: model.get('assocs')
		};
		console.log('model %s changed:', model.id, payload[model.id]);
		storage.set(payload);
	}

	chrome.storage.onChanged.addListener(function(changes) {
		Object.keys(changes).forEach(function(key) {
			if (key in collection) {
				collection[key].set(changes[key], {silent: true});
			}
		});
	});

	// setup relationships between models
	editorModel.on('change:files', function(model, value) {
		eachModel(function(model, id) {
			model.set('editorFiles', value);
		});
	});

	client
		.on('editor-connect files', function(payload) {
			editorModel.set('files', payload.files || []);
		})
		.on('editor-disconnect', function() {
			editorModel.set('files', []);
		});

	// clean up model collection when tab is closed
	chrome.tabs.onRemoved.addListener(function(tabId, info) {
		console.log('Tab removed', tabId);
		// TODO invalidate models for closed tab.
		// Querying chrome.tabs with ID of closed tab won’t
		// return tab
	});

	return {
		/**
		 * Returns model by given id or tab.
		 * @param  {String}   id       Model ID (page url) or tab object
		 * @param  {Function} callback 
		 */
		get: function(id, callback) {
			if (!id) {
				return callback();
			}

			if (typeof id === 'object') { // looks like a tab object
				id = id.url;
			}

			return createModel(id, callback);
		},

		/**
		 * Returns list of currently active models that can be used
		 * for patching
		 * @param {Function} callback
		 */
		active: function(callback) {
			chrome.tabs.query({highlighted: true}, function(tabs) {
				var models = [];
				var next = function() {
					if (!tabs.length) {
						return callback(model);
					}

					createModel(tabs.pop(), function(model) {
						if (model && model.get('enabled')) {
							models.push(model);
						}
						next();
					});
				};
				next();
			});
		},

		/**
		 * Returns matching file URL from active models. 
		 * The `callback` argument receives array of objects
		 * with `url` and `type` ('browser' or 'editor') keys
		 * @param  {String}   url      
		 * @param  {Function} callback
		 */
		matchingUrl: function(url, callback) {
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
	};
});