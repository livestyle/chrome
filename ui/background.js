define(function(require) {
	var modelController = require('../lib/controllers/model');
	var client = require('../node_modules/livestyle-client/index');

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

	client
	.on('diff', function(data) {
		console.log('received diff message', data);
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

				console.log('stylesheet url:', stylesheetUrl);
				if (stylesheetUrl) {
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
	})
	.connect();
});