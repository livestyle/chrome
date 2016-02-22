/**
 * LiveStyle module for DevTools: creates connection to background page to
 * update DevTools resources of the page
 */
'use strict';
const wnd = chrome.devtools.inspectedWindow;
const tabId = wnd.tabId;
const port = chrome.runtime.connect({name: `devtools:${tabId}`});

sendStylesheetList();

wnd.onResourceContentCommitted.addListener((res, content) => {
    if (isStylesheet(res)) {
        sendMessage('resource-updated', {url: res.url, content});
    }
});

wnd.onResourceAdded.addListener(res => {
    isStylesheet(res) && sendStylesheetList();
});

port.onMessage.addListener(message => {
    if (message.action === 'update-resource') {
        getStylesheets().then(resources => {
            resources.some(res => {
                if (res.url === message.data.url) {
                    res.setContent(message.data.content, true, err => {
                        // tell sender that resource was updated
                        var response = {url: res.url};
                        if (err) {
                            response.error = err;
                        }
                        sendMessage('update-resource', response);
                    });
                    return true;
                }
            });
        });
    }
});

function sendStylesheetList() {
    getStylesheets()
    .then(resources => sendMessage('resource-list', {items: resources.map(res => res.url)}));
}

function sendMessage(action, data) {
    port.postMessage({action, data});
}

function getStylesheets() {
    return new Promise(resolve => {
        wnd.getResources(resources => resolve(resources.filter(isStylesheet)));
    });
}

function isStylesheet(res) {
	return res.url && res.type === 'stylesheet';
}
