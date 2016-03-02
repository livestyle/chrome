/**
 * LiveStyle module for DevTools: creates connection to background page to
 * update DevTools resources of the page
 */
'use strict';
import {debounce} from './lib/utils';

const wnd = chrome.devtools.inspectedWindow;
const tabId = wnd.tabId;
const refreshTransactions = new Map();
const pendingRefresh = new Set();
var port;

if (tabId) {
    // create connection only if there’s valid inspected tab id
    // (it will be undefined for background pages, for example)
    port = chrome.runtime.connect({name: `devtools:${tabId}`});
    wnd.onResourceContentCommitted.addListener(onResourceCommitted);
    wnd.onResourceAdded.addListener(onResourceAdded);
    port.onMessage.addListener(onPortMessage);
}

function onPortMessage(message) {
    var {action, data} = message;
    switch (action) {
        case 'update-resource':
            return getStylesheet(data.url)
            .then(res => setContent(res, data.content, true))
            .then(content => sendMessage(action, {url: data.url}))
            .catch(error => sendMessage(action, {url: data.url, error}));

        case 'get-resource-content':
            return getStylesheet(data.url)
            .then(getContent)
            .then(content => sendMessage(action, {url: data.url, content}))
            .catch(error => sendMessage(action, {url: data.url, error}));

        case 'get-stylesheets':
            return getStylesheets()
            .then(resources => {
                return Promise.all(resources.map(getContent))
                .then(contents => contents.reduce((out, content, i) => {
                    out[resources[i].url] = content;
                    return out;
                }, {}));
            })
            .then(items => sendMessage(action, {items}))
            .catch(error => sendMessage(action, {error}));
    }
}

function onResourceAdded(res) {
    if (isStylesheet(res)) {
        getContent(res).then(content => sendMessage('resource-added', {url: res.url, content}));
    }
}

function onResourceCommitted(res, content) {
    if (isStylesheet(res)) {
        sendMessage('resource-updated', {url: res.url, content});
        refresh(res, content);
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

function isStylesheet(res) {
	return res.url && res.type === 'stylesheet';
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

function getContent(res) {
    return new Promise(resolve => res.getContent(resolve));
}

function setContent(res, content, commit=false) {
    return new Promise((resolve, reject) => {
        res.setContent(content, commit, err => err ? reject(err) : resolve(content));
    });
}

/**
 * Re-set content of updated resource: this effectively updates all DevTools
 * resources inside inner iframes of inspected tab (required for Re:view)
 * @param  {Resource} res
 * @param  {String} content
 */
function refresh(res, content) {
    var key = res.url;
    if (pendingRefresh.has(key)) {
        return;
    }

    if (!refreshTransactions.has(key)) {
        refreshTransactions.set(key, debounce(function(res, content) {
            refreshTransactions.delete(key);
            pendingRefresh.add(key);
            res.setContent(content, true, () => {
                pendingRefresh.delete(key);
                res = content = key = null;
            });
        }, 1000));
    }
    refreshTransactions.get(key)(res, content);
}
