define(function(require) {
	var modelController = require('../lib/controllers/model');
	var devtoolsController = require('../lib/controllers/devtools');
	var userStylesheets = require('../lib/helpers/user-stylesheets');
	var utils = require('../lib/utils');
	var client = require('../node_modules/livestyle-client/index');
	var patcher = require('../node_modules/livestyle-patcher/index');

	var worker = patcher(client, {
		worker: '../out/worker.js'
	});

	worker.addEventListener('message', function(message) {
		var payload = message.data;

		if (payload.name === 'init') {
			return console.log('%c%s', 'color:green;font-size:1.1em;font-weight:bold;', payload.data);
		}

		if (payload.status === 'error') {
			return console.error(payload.data);
		}
	});

	function copy(obj) {
		return utils.extend({}, obj);
	}

	chrome.runtime.onMessage.addListener(function(message) {
		switch (message.name) {
			case 'add-user-stylesheet':
				modelController.current(function(model, tab) {
					var stylesheets = copy(model.get('userStylesheets'));
					var maxId = 0;
					Object.keys(stylesheets).forEach(function(url) {
						var m = url.match(/^livestyle:([0-9]+)$/);
						if (m && +m[1] > maxId) {
							maxId = +m[1];
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
					var stylesheets = copy(model.get('userStylesheets'));
					var assocs = copy(model.get('assocs'));
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

	self.LiveStyle = {
		/**
		 * Returns model for currently opened page
		 */
		getCurrentModel: function(callback) {
			modelController.current(callback);
		},

		log: function(message) {
			console.log('%c[Content]', 'background:#e67e22;color:#fff', message);
		}
	};

	function applyDiff(data) {
		modelController.active(function(models) {
			models.forEach(function(item) {
				var model = item.model;
				var assocs = model.associations();

				if (data.uri in assocs) {
					// This diff result is for browser file, meaning that browser
					// file was updated and editor should receive these changes
					return client.send('incoming-updates', {
						uri: assocs[data.uri],
						patches: data.patches
					});
				}

				// Looks like this diff result is coming from editor file:
				// find corresponding browser file and patch it
				var stylesheetUrl = null;
				Object.keys(assocs).some(function(key) {
					if (assocs[key] === data.uri) {
						stylesheetUrl = key;
						return true;
					}
				});

				if (stylesheetUrl) {
					console.log('apply diff on', stylesheetUrl, data.patches);
					chrome.tabs.sendMessage(item.tab.id, {
						name: 'apply-cssom-patch',
						data: {
							stylesheetUrl: stylesheetUrl,
							patches: data.patches
						}
					});
					devtoolsController.saveDiff(item.tab.id, stylesheetUrl, data.patches);
				}
			});
		});
	}
	

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
});