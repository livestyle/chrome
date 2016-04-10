/**
 * Displays browser action icon according to current activity state
 */
'use strict';

const images = {
	disabled: './icon/ba-disabled.png',
	active:   './icon/ba-active.png',
	warning:  './icon/ba-warning.png'
};

const tabQuery = {
	windowType: 'normal',
	status: 'complete'
};

export default function(tabs) {
    chrome.tabs.query(tabQuery, browserTabs => {
        browserTabs.forEach(tab => chrome.browserAction.setIcon({
            path: tabs.has(tab.id) && tabs.get(tab.id).session
				? images.active
				: images.disabled,
            tabId: tab.id
        }));
    });
};
