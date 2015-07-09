/**
 * Controls browser action icon state depending on 
 * user activity with tabs
 */
'use strict';

import * as modelController from './model';
import * as icon from '../lib/browser-action-icon';
import LiveStyleModel from '../lib/livestyle-model';

export function watchErrors(tracker) {
	tracker.on('change:error', function() {
		if (this.get('error')) {
			modelController.current((model, tab) => icon.state(tab.id, 'error'));
		} else {
			update();
		}
	});
}

export function update() {
	chrome.tabs.query({active: true, windowType: 'normal'}, function(tabs) {
		tabs.forEach(function(tab) {
			modelController.get(tab, model => updateIconState(tab, model));
		});
	});
}

function updateIconState(tab, model) {
	if (typeof tab === 'object') {
		tab = tab.id;
	}

	var state = model.get('enabled') ? 'active' : 'disabled';
	icon.state(tab, state);
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
		tabs.forEach(tab => updateIconState(tab, model));
	});
});

update();
chrome.tabs.onActivated.addListener(update);
chrome.tabs.onRemoved.addListener(icon.clearState);
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	if (changeInfo.status === 'loading') {
		return icon.clearState(tabId);
	}

	if (changeInfo.status === 'complete' && tab.active) {
		update();
	}
});
