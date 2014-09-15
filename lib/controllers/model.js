/**
 * Controller for LiveStyle model: creates or restores 
 * model for given tab (page url) and automatically syncs
 * changes with storage backend
 */
define(function(require) {
	var Model = require('../livestyle-model');
	
	var collection = {}; // collection of all active models
	var storage = chrome.storage.local;

	function createModel(id, callback) {
		var model = new Model(id);
		collection[id] = model;
		storage.get(id, function(items) {
			items = items || {};
			if (items[id]) {
				model.set(items[id]);
			}

			callback(model);
		});
	}

	// sync all changes with backend
	Model.on('update', function(model) {
		var payload = {};
		payload[model.id] = model.toJSON();
		storage.set(payload);
	});

	chrome.storage.onChanged.addListener(function(changes) {
		Object.keys(changes).forEach(function(key) {
			if (key in collection) {
				collection[key].set(changes[key]);
			}
		});
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