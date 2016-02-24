/**
 * LiveStyle module for DevTools: creates connection to background page to
 * update DevTools resources of the page
 */
'use strict';
const wnd = chrome.devtools.inspectedWindow;
const tabId = wnd.tabId;
const port = chrome.runtime.connect({name: `devtools:${tabId}`});

getStylesheets().then(items => {
    sendStylesheetList(items);
    requestUpdatedContent(items);
});

wnd.onResourceContentCommitted.addListener((res, content) => {
    if (isStylesheet(res)) {
        sendMessage('resource-updated', {url: res.url, content});
    }
});

wnd.onResourceAdded.addListener(res => {
    if (isStylesheet(res)) {
        getStylesheets().then(sendStylesheetList);
        requestUpdatedContent(res);
    }
});

port.onMessage.addListener(message => {
    var {action, data} = message;
    if (action === 'update-resource') {
        getStylesheets().then(resources => {
            resources.some(res => {
                if (res.url === data.url) {
                    res.setContent(data.content, true, err => {
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
    } else if (action === 'get-resource-content') {
        getStylesheets().then(resources => {
            resources.some(res => {
                if (res.url === data.url) {
                    res.getContent(content => {
                        sendMessage('get-resource-content', {
                            url: res.url,
                            content
                        });
                    });
                    return true;
                }
            });
        });
    }
});

function sendStylesheetList(items) {
    sendMessage('resource-list', {items: items.map(resourceUrl)});
}

function requestUpdatedContent(items) {
    if (!Array.isArray(items)) {
        items = [items];
    }
    sendMessage('request-updated-content', {items: items.map(resourceUrl)});
}

function resourceUrl(res) {
    return res.url;
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
