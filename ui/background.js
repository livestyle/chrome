define(function(require) {
	var modelController = require('../lib/controllers/model');
	var devtoolsController = require('../lib/controllers/devtools');
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

	self.LiveStyle = {
		/**
		 * Returns model for currently opened page
		 */
		getCurrentModel: function(callback) {
			chrome.tabs.query({currentWindow: true, highlighted: true, windowType: 'normal'}, function(tabs) {
				modelController.get(tabs && tabs[0], callback);
			});
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