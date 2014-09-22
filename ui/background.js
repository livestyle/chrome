define(function(require) {
	var modelController = require('../lib/controllers/model');
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

		// console.log('worker message', payload);
	});

	self.LiveStyle = {
		/**
		 * Returns model for currently opened page
		 */
		getCurrentModel: function(callback) {
			chrome.tabs.query({currentWindow: true, highlighted: true}, function(tabs) {
				modelController.get(tabs && tabs[0], callback);
			});
		}
	};

	function applyDiff(data) {
		modelController.active(function(models) {
			models.forEach(function(item) {
				var model = item.model;
				var browserFiles = model.get('browserFiles') || [];
				var assocs = model.associations();
				var stylesheetUrl = null;

				if (~browserFiles.indexOf(data.uri)) {
					stylesheetUrl = data.uri;
				} else {
					Object.keys(assocs).some(function(key) {
						if (assocs[key] === data.uri) {
							stylesheetUrl = key;
							return true;
						}
					});
				}

				if (stylesheetUrl) {
					console.log('apply diff on', stylesheetUrl);
					chrome.tabs.sendMessage(item.tab.id, {
						name: 'apply-cssom-patch',
						data: {
							stylesheetUrl: stylesheetUrl,
							patches: data.patches
						}
					});
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