/**
 * Main controller to work with DevTools resources
 */
'use strict';
import {TAB} from 'extension-app/lib/action-names';
import request from './request';
import app from '../../lib/app';
import {diff, patch} from '../../lib/patcher';
import {error, debounce, objToMap} from '../../lib/utils';

const ports = new Map();
const pendingUpdates = new Map();
const sessionIds = new Set();
const patchTransactions = new Set();
const diffTransactions = new Map();
const patchDebounce = 200;
const diffDebounce = 150;

const applyPatch = debounce((tabId, resourceUrl) => {
    var key = getKey(tabId, resourceUrl);
    if (patchTransactions.has(key)) {
        // transaction is in progress, just wait until it finished, it will
        // restart if required
        return;
    }

    patchTransactions.add(key);
    createPatchTransaction(tabId, resourceUrl).then(success => {
        patchTransactions.delete(key);
        if (getResourcePatches(tabId, resourceUrl) && ports.has(tabId)) {
            // there are more updates after transaction is complete: pend new
            // patch transaction
            applyPatch(tabId, resourceUrl);
        }
    });
}, patchDebounce);

const calculateDiff = debounce((tabId, resourceUrl, content) => {
    var key = getKey(tabId, resourceUrl);
    var exists = diffTransactions.has(key);
    diffTransactions.set(key, content);
    if (exists) { // diff transaction is already in progress
        return;
    }

    var stylesheets = getDevtoolsStylesheets(tabId);
    if (!stylesheets.has(resourceUrl)) {
        // missing some important data, abort transaction
        return diffTransactions.delete(key);
    }

    console.groupCollapsed('DevTools diff transaction for %s (tab id: %d)', resourceUrl, tabId);
    console.time('Diff time');
    var prevContent = stylesheets.get(resourceUrl) || '';
    Promise.race([
        diff(prevContent, content),
        rejectOnTimeout(10000)
    ])
    .then(patches => {
        console.log('diff calculated', patches);
        // diff calculated, check out current transaction lock value: if it’s
        // not equal to one we’ve started transaction, then there were more content
        // updates so we can simply discart current patches and calculate diff again
        var curContent = diffTransactions.get(key);
        if (curContent !== content) {
            // restore original content which was replaced in `update()` call
            // updateResourceInStore(tabId, resourceUrl, prevContent);
            return cancel('Resource content was changed when diffing, abort');
        }

        updateResourceInStore(tabId, resourceUrl, content);

        // Forge diff payload for client so default handler from background page
        // will apply it to all editors and sessions
        app.client.send('diff', {
            uri: resourceUrl,
            synaxt: 'css',
            patches
        });
        var tab = getTab(tabId);
        if (tab && tab.session && tab.session.mapping.has(resourceUrl)) {
            app.client.send('diff', {
                excludeTabId: [tabId],
                uri: tab.session.mapping.get(resourceUrl),
                syntax: 'css',
                patches
            });
        }
    })
    .catch(err => {
        console.error(err);
        // check if we can restart transaction
        if (getDevtoolsStylesheets(tabId).has(resourceUrl) && diffTransactions.has(key)) {
            console.log('Restart transactions due to errors');
            calculateDiff(tabId, resourceUrl, diffTransactions.get(key));
        }
    })
    .then(() => {
        // clean-up
        console.timeEnd('Diff time');
        console.groupEnd();
        diffTransactions.delete(key);
        key = exists = prevContent = null;
    });
}, diffDebounce);

chrome.runtime.onConnect.addListener(port => {
    if (/^devtools:/.test(port.name)) {
        onPortConnect(port);
    }
});

// Watch for new tabs: if tab is added, fetch stylesheets for it
app.subscribe(tabs => {
    // find newly-added tabs with LiveStyle-enabled sessions
    var newSessions = [];
    tabs.forEach((tab, tabId) => {
        if (tab.session && !sessionIds.has(tabId) && !getDevtoolsStylesheets(tabId)) {
            newSessions.push(tabId);
        }
    });

    sessionIds.clear();
    for (let tabId of tabs.keys()) {
        sessionIds.add(tabId)
    }
    newSessions.forEach(setStylesheetsForSession);

    // update activity state for each connected port
    ports.forEach(sendActivityState);
}, 'tabs');

// update DevTools resource when there are pending patches
app.subscribeDeepKey('tabs', 'session.patches', (tab, tabId) => {
	applyPatches(tabId, tab.session.patches);
});

/**
 * Update DevTools data for session of given `tabId`
 * @param  {Number} tabId
 * @return {Promise}
 */
export default function(tabId) {
    return setStylesheetsForSession(tabId);
}

function onPortMessage(message, port) {
    var {action, data} = message;
    console.log('%c[DevTools]%c received message %c%s %cwith data %o on port %s', 'background-color:#344a5d;color:#fff', '', 'font-weight:bold;', action, '', data, port.name);
    switch (action) {
        case 'resource-updated':
            return onResourceUpdate(port.tabId, data);
        case 'resource-added':
            return updateResourceInStore(port.tabId, data.url, data.content);
    }
}

function onPortConnect(port) {
    var [name, tabId] = port.name.split(':');
    port.tabId = +tabId;
    ports.set(port.tabId, port);
    port.onMessage.addListener(onPortMessage);
    port.onDisconnect.addListener(onPortDisconnect);
    console.log('Port %s connected, total connection: %d', port.name, ports.size);

    // check if there’s active session for current tab id and update stylesheets
    var tab = getTab(port.tabId);
    if (tab && tab.session) {
        setStylesheetsForSession(port.tabId)
        .then(() => applyPatches(port.tabId, tab.session.patches));
    }
    sendActivityState(port);
}

function onPortDisconnect(port) {
    port.onMessage.removeListener(onPortMessage);
    port.onDisconnect.removeListener(onPortDisconnect);
    ports.delete(port.tabId);
    // reset session DevTools stylesheets
    app.dispatch({
        type: TAB.SET_STYLESHEET_DATA,
        id: port.tabId,
        items: new Map(),
        zone: 'devtools'
    });
    console.log('Port %s disconnected, total connection: %d', port.name, ports.size);
}

/**
 * Handles incoming resource update that occured when user updated resource
 * in DevTools or LiveStyle forced resource update
 * @param  {Number} tabId
 * @param  {Object} res  Resource descriptor
 */
function onResourceUpdate(tabId, res) {
    // Handle edge case: we requested resource update, but before actual update
    // happened, user updated DevTools, which results in multiple `resource-updated`
    // message between `pendingUpdates` transaction.
    // To properly handle this case, we will ensure that resource updated with
    // content we asked for, otherwise request a diff
    var key = getKey(tabId, res.url);
    if (!pendingUpdates.has(key) || pendingUpdates.get(key) !== res.content) {
        calculateDiff(tabId, res.url, res.content);
    } else {
        console.log('skip resource update, part of transaction');
    }
}

/**
 * Fetches DevTools stylesheets for given tab id and updates matched session in
 * global store
 * @param {Number} tabId
 */
function setStylesheetsForSession(tabId) {
    var port = ports.get(tabId);
    if (!port) {
        return Promise.resolve();
    }

    return request(port, 'get-stylesheets').then(data => app.dispatch({
        type: TAB.SET_STYLESHEET_DATA,
        id: tabId,
        items: objToMap(data.items),
        zone: 'devtools'
    }));
}

/**
 * Sets content of resource with given URL in `tabId` DevTools instance.
 * Returns Promise which is resolved when resource is updated.
 * @param  {Number} tabId
 * @param  {String} url
 * @param  {String} content
 * @return {Promise}
 */
export function update(tabId, url, content) {
    var port = ports.get(tabId);
    if (!port) {
        return errorNoDevTools(tabId);
    }

    var key = getKey(tabId, url);
    pendingUpdates.set(key, content);
    return request(port, 'update-resource', ['url'], {url, content})
    .then(() => {
        pendingUpdates.delete(key);
        updateResourceInStore(tabId, url, content);
    })
    .catch(err => {
        pendingUpdates.delete(key);
        return Promise.reject(err);
    });
}

/**
 * Fetches content of resource with given URL from `tabId` DevTools instance
 * @param  {Number} tabId
 * @param  {String} url
 * @return {Promise}
 */
export function getContent(tabId, url) {
    var port = ports.get(tabId);
    if (!port) {
        return errorNoDevTools(tabId);
    }

    return request(port, 'get-resource-content', ['url'] , {url})
    .then(resp => resp.content);
}

function getKey(tabId, url) {
	return `${tabId}+${url}`;
}

function updateResourceInStore(tabId, url, content) {
    app.dispatch({
        type: TAB.UPDATE_STYLESHEET_ITEM,
        id: tabId,
        itemId: url,
        itemValue: content,
        zone: 'devtools'
    });
}

function errorNoDevTools(tabId) {
    return Promise.reject(error('ENODEVTOOLS', 'No connected DevTools for tab ' + tabId));
}

function cancel(reason) {
    reason && console.info(reason);
    return Promise.reject(error('ECANCEL', 'Transaction was cancelled'));
}

function rejectOnTimeout(timeout=1000) {
	return new Promise((response, reject) => {
		setTimeout(() => reject(error('ETIMEOUT', 'Timeout')), timeout);
	});
}

function getResourcePatches(tabId, url) {
	var tab = getTab(tabId);
	return tab && tab.session && tab.session.patches.get(url) || null;
}

function applyPatches(tabId, patches) {
	if (patches && ports.has(tabId)) {
		patches.forEach((patches, url) => applyPatch(tabId, url));
	}
}

function createPatchTransaction(tabId, resourceUrl) {
    var snapshot;
    console.groupCollapsed('DevTools patch transaction for %s (tab id: %d)', resourceUrl, tabId);
    console.time('Patch time');
    return getContent(tabId, resourceUrl)
    .then(content => {
        // save patches snapshot and apply them on resource content
        snapshot = getResourcePatches(tabId, resourceUrl);
        if (!snapshot) {
            return cancel('Session was destroyed or empty patch list, aborting');
        }

        return Promise.race([
            patch(content, snapshot),
            rejectOnTimeout(10000)
        ]);
    })
    .then(response => {
        console.info('Resource patched, try to update content');
        // make sure session still exists and no new patches were added
        if (snapshot !== getResourcePatches(tabId, resourceUrl)) {
            return cancel('Received more updates when patching resource, abort');
        }

        // everything seems fine: we can update DevTools resource
        // and drain patch queue
        app.dispatch({
            type: TAB.CLEAR_PATCHES,
            id: tabId,
            uri: resourceUrl
        });
        return update(tabId, resourceUrl, response.content).then(() => true);
    })
    .catch(err => {
        // in most cases errors are harmless to continue
        if (err.code !== 'ECANCEL') {
            console.error('Got error', err);
        }
        return false;
    })
    .then(success => {
        console.timeEnd('Patch time');
        console.groupEnd();
        snapshot = null;
        return success;
    });
}

function sendActivityState(port) {
    port.postMessage({
        action: 'activity-state',
        data: {enabled: sessionIds.has(port.tabId)}
    });
}

function getTab(tabId) {
    return app.getStateValue('tabs').get(tabId);
}

function getDevtoolsStylesheets(tabId) {
    var tab = getTab(tabId);
    return tab && tab.stylesheets.devtools || new Map();
}
