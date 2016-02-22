/**
 * Displays browser action icon according to current activity state
 */
'use strict';

const images = {
	disabled: './icon/ba-disabled.png',
	active:   './icon/ba-active.png',
	warning:  './icon/ba-warning.png'
};

export default function(sessions) {
    chrome.tabs.query({
        windowType: 'normal',
        status: 'complete'
    }, tabs => {
        tabs.forEach(tab => chrome.browserAction.setIcon({
            path: tab.id in sessions ? images.active : images.disabled,
            tabId: tab.id
        }));
    });
};
