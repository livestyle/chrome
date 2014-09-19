/**
 * Controller for LiveStyle model: creates or restores 
 * model for given tab (page url) and automatically syncs
 * changes with storage backend.
 */
define(function(require) {
	var Model = require('../model');
	var LiveStyleModel = require('../livestyle-model');
	var client = require('../../node_modules/livestyle-client/index');
	
	var collection = {}; // collection of all active page models
	var storage = chrome.storage.local;
	var editorModel = new Model();

	function eachModel(fn) {
		Object.keys(collection).forEach(function(key) {
			fn(collection[key], key);
		});
	}

	function createModel(id, callback) {
		var model = new Model(id);
		collection[id] = model;
		storage.get(id, function(items) {
			items = items || {};
			if (items[id]) {
				model.set(items[id]);
			}

			callback(model.on('change', saveChanges));
		});
	}

	function saveChanges(model) {
		var payload = {};
		payload[model.id] = model.toJSON();
		storage.set(payload);
	}

	chrome.storage.onChanged.addListener(function(changes) {
		Object.keys(changes).forEach(function(key) {
			if (key in collection) {
				collection[key].set(changes[key]);
			}
		});
	});

	// setup model relationships between models
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

	return {
		/**
		 * Returns model by given id or tab
		 * @param  {String}   id       Model ID (page url) or tab object
		 * @param  {Function} callback 
		 */
		get: function(id, callback) {
			if (typeof id === 'object') { // looks like a tab object
				id = id.url;
			}

			if (id in collection) {
				return callback(collection[id]);
			}

			createModel(id, callback);
		}
	};
});