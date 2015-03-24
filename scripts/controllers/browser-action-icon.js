/**
 * Controls browser action icon state depending on 
 * user activity with tabs
 */
define(function(require) {
	var icon = require('../browser-action-icon');
	var modelController = require('./model');
	var LiveStyleModel = require('../livestyle-model');

	function updateIconState(tab, model) {
		if (typeof tab === 'object') {
			tab = tab.id;
		}
		var state = model.get('enabled') ? 'active' : 'disabled';

		icon.state(tab, state);
	}

	function updateActiveTabs() {
		chrome.tabs.query({active: true, windowType: 'normal'}, function(tabs) {
			tabs.forEach(function(tab) {
				modelController.get(tab, function(model) {
					updateIconState(tab, model);
				});
			});
		});
	}

	/**
	 * Returns list of active tabs that matches given module
	 * @param {LiveStyleModel} model
	 * @param {Function} callback 
	 */
	function activeTabsForModel(model, callback) {
		chrome.tabs.query({active: true, windowType: 'normal'}, function(tabs) {
			callback(tabs.filter(function(tab) {
				return modelController.id(tab) === model.id;
			}));
		});
	}

	// listen to changes on activity state of models and update
	// browser icons accordingly
	LiveStyleModel.on('change:enabled', function(model) {
		activeTabsForModel(model, function(tabs) {
			tabs.forEach(function(tab) {
				updateIconState(tab, model);
			});
		});
	});

	updateActiveTabs();
	chrome.tabs.onActivated.addListener(updateActiveTabs);
	chrome.tabs.onRemoved.addListener(icon.clearState);
	chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
		if (changeInfo.status === 'loading') {
			return icon.clearState(tabId);
		}

		if (changeInfo.status === 'complete' && tab.active) {
			updateActiveTabs();
		}
	});

	return {
		watchErrors: function(tracker) {
			tracker.on('change:error', function() {
				var err = this.get('error');
				if (err) {
					modelController.current(function(model, tab) {
						icon.state(tab.id, 'error');
					});
				} else {
					updateActiveTabs();
				}
			});
		},
		
		update: updateActiveTabs
	};
});