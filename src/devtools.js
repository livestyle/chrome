/**
 * LiveStyle module for DevTools: creates connection to background page to
 * update DevTools resources of the page
 */
'use strict';
const wnd = chrome.devtools.inspectedWindow;
const tabId = wnd.tabId;
var port;

if (tabId) {
    // create connection only if there’s valid inspected tab id
    // (it will be undefined for abckground pages, for example)
    port = chrome.runtime.connect({name: `devtools:${tabId}`});
    getStylesheets().then(sendStylesheetList);

    wnd.onResourceContentCommitted.addListener(onResourceCommitted);
    wnd.onResourceAdded.addListener(onResourceAdded);
    port.onMessage.addListener(onPortMessage);
}

function onPortMessage(message) {
    var {action, data} = message;
    if (action === 'update-resource') {
        getStylesheet(data.url)
        .then(res => setContent(res, data.content, true))
        .then(content => sendMessage(action, {url: data.url}))
        .catch(error => sendMessage(action, {url: data.url, error}));
    } else if (action === 'get-resource-content') {
        getStylesheet(data.url)
        .then(getContent)
        .then(content => sendMessage(action, {url: data.url, content}))
        .catch(error => sendMessage(action, {url: data.url, error}));
    }
}

function onResourceAdded(res) {
    if (isStylesheet(res)) {
        getStylesheets().then(sendStylesheetList);
    }
}

function onResourceCommitted(res, content) {
    if (isStylesheet(res)) {
        sendMessage('resource-updated', {url: res.url, content});
    }
}

function sendStylesheetList(items) {
    sendMessage('resource-list', {items: items.map(resourceUrl)});
}

function resourceUrl(res) {
    return res.url;
}

function sendMessage(action, data) {
    port.postMessage({action, data});
}

function getStylesheet(url) {
    return getStylesheets().then(resources => {
        var res = resources.filter(res => res.url === url)[0];
        if (res) {
            return res;
        }

        let err = new Error('Resource not found');
        err.code = 'ENOTFOUND';
        err.url = url;
        return Promise.reject(err);
    });
}

function getStylesheets() {
    return new Promise(resolve => {
        wnd.getResources(resources => resolve(resources.filter(isStylesheet)));
    });
}

function isStylesheet(res) {
	return res.url && res.type === 'stylesheet';
}

function getContent(res) {
    return new Promise(resolve => res.getContent(resolve));
}

function setContent(res, content, commit=false) {
    return new Promise((resolve, reject) => {
        res.setContent(content, commit, err => err ? reject(err) : resolve(content));
    });
}
