define(function(require) {
	var modelController = require('../lib/controllers/model');
	var client = require('../node_modules/livestyle-client/index');

	// XXX remove in production
	chrome.storage.local.clear();

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

	client.connect();
});