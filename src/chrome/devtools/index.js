/**
 * Main controller to work with DevTools resources
 */
'use strict';
import {dispatch, subscribe, subscribeDeepKey, getStateValue} from '../../app/store';
import {patch} from '../../app/patcher';
import {SESSION} from '../../app/action-names';
import {error, debounce} from '../../lib/utils';
import request from './request';

const ports = new Map();
const locks = new Set();
const sessionIds = new Set();
const patchTransactions = new Set();
const patchDebounce = 1000;

const applyPatch = debounce(function(tabId, resourceUrl) {
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

chrome.runtime.onConnect.addListener(port => {
    if (/^devtools:/.test(port.name)) {
        onPortConnect(port);
    }
});

// Watch for new sessions: if session is added, fetch stylesheets for it
subscribe(sessions => {
    var tabIds = Object.keys(sessions).map(tabId => +tabId);
    var newSessions = tabIds.filter(tabId => !sessionIds.has(tabId) && !sessions[tabId].devtoolsStylesheets);
    sessionIds.clear();
    tabIds.forEach(tabId => sessionIds.add(tabId));
    newSessions.forEach(setStylesheetsForSession);
}, 'sessions');

// update DevTools resource when there are pending patches
subscribeDeepKey('sessions', 'patches', (session, tabId) => {
	applyPatches(+tabId, session.patches);
});

function onPortMessage(message, port) {
    var {action, data} = message;
    console.log('%c[DevTools]%c received message %c%s %con port %s', 'background-color:#344a5d;color:#fff', '', 'font-weight:bold;', action, '', port.name);
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
    console.log('devtools connected %s, total connection: %d', port.name, ports.size);

    // check if there’s active session for current tab id and update stylesheets
    var session = getStateValue('sessions')[tabId];
    if (session) {
        setStylesheetsForSession(port.tabId);
        applyPatches(tabId, session.patches);
    }
}

function onPortDisconnect(port) {
    port.onMessage.removeListener(onPortMessage);
    port.onDisconnect.removeListener(onPortDisconnect);
    ports.delete(port.tabId);
    // reset session DevTools stylesheets
    dispatch({
        type: SESSION.SET_DEVTOOLS_STYLESHEETS,
        tabId,
        items: new Map()
    });
    console.log('devtools %s disconnected, total connection: %d', port.name, ports.size);
}

/**
 * Handles incoming resource update that occured when user updated resource
 * in DevTools or LiveStyle forced resource update
 * @param  {Number} tabId
 * @param  {Object} res  Resource descriptor
 */
function onResourceUpdate(tabId, res) {
    if (isLocked(tabId, res.url)) {
        return console.log('updated resource is locked, do nothing');
    }

    // Update resource content in all connected DevTools including one that
    // initiated this call to force update resources in embedded iframes as well
    // (required for Re:view)
    // TODO check if Re:view enabled and filter port if disabled?
    update(tabId, res.url, res.content);
}

/**
 * Fetches DevTools stylesheets for given tab id and updates matched session in
 * global store
 * @param {Number} tabId
 */
function setStylesheetsForSession(tabId) {
    var port = ports.get(tabId);
    if (port) {
        request(port, 'get-stylesheets')
        .then(data => {
            // convert items object to map
            return Object.keys(data.items || {})
            .reduce((out, key) => out.set(key, data.items[key]), new Map());
        })
        .then(items => dispatch({type: SESSION.SET_DEVTOOLS_STYLESHEETS, tabId, items}));
    }
}

/**
 * Sets content of resource with given URL in `tabId DevTools instance.
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

    lock(tabId, url);
    return request(port, 'update-resource', ['url'], {url, content})
    .then(() => {
        unlock(tabId, url);
        updateResourceInStore(tabId, url, content);
    })
    .catch(err => {
        unlock(tabId, url);
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

/**
 * Locks given resource for update transaction. If it’s locked, all incoming
 * events or updates for this resource will be ignored
 * @param  {Number} tabId
 * @param  {String} url
 * @return
 */
function lock(tabId, url) {
    console.log('locking %s (tab %d)', url, tabId);
    locks.add(getKey(tabId, url));
}

/**
 * Removes resource lock for given URL
 * @param  {Number} tabId
 * @param  {String} url
 */
function unlock(tabId, url) {
    console.log('unlocking %s (tab %d)', url, tabId);
    locks.delete(getKey(tabId, url));
}

/**
 * Check if given resource is locked for update transaction
 * @param  {Number} tabId
 * @param  {String} url
 */
function isLocked(tabId, url) {
    return locks.has(getKey(tabId, url));
}

function getKey(tabId, url) {
	return `${tabId}+${url}`;
}

function updateResourceInStore(tabId, url, content) {
    dispatch({type: SESSION.UPDATE_DEVTOOLS_STYLESHEET, tabId, url, content});
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
	var session = getStateValue('sessions')[tabId];
	return session && session.patches.get(url) || null;
}

function applyPatches(tabId, patches) {
	if (patches && ports.has(tabId)) {
		patches.forEach((patches, url) => applyPatch(tabId, url));
	}
}

function createPatchTransaction(tabId, resourceUrl) {
    var snapshot;
    console.groupCollapsed('DevTools patch transaction for', tabId, resourceUrl);
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
        dispatch({
            type: SESSION.RESET_RESOURCE_PATCHES,
            uri: resourceUrl,
            tabId
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
        snapshot = null;
        console.groupEnd();
        return success;
    });
}
