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
    chrome.tabs.query(tabQuery, tabs => {
        tabs.forEach(tab => chrome.browserAction.setIcon({
            path: tabs.has(tab.id) ? images.active : images.disabled,
            tabId: tab.id
        }));
    });
};
