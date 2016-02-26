/**
 * Creates a DevTools resource update transaction. DevTools resource update is
 * very tricky:
 * – it’s required to update styles in Elements panel (CSSOM update is not enough)
 * – it’s **much** slower than CSSOM update, especially on large CSS files
 * – DevTools update will reset all CSSOM updates. Thus, if a slow update was
 *   initialed and user made a few changes in CSSOM before it was complete,
 *   these changes will be discarted causing “janky” visual update.
 *
 * In order to solve these issues, we’ll introduce a transaction that carefully
 * treats all incoming updates:
 * – Transaction is a debounced function that will be fired only after user stops
 *   updating CSS for some time
 * – Transaction takes current session patches snapshot and initiates `apply-patch`
 *   LiveStyle call on resource content.
 * – When `apply-patch` is complete, compare current session patches with
 *   previos snapshot. If they are equal, then there were no updates during patches
 *   so we can proceed to next step. Otherwise (user made some updates) restart
 *   transaction
 * – Update DevTools resource content with patched one and drain session patches
 * — When update is complete, check if there are new incoming patches and
 *   create a new transaction if required
 */
'use strict';
import * as devtools from '../lib/devtools-resources';
import {getStateValue, dispatch} from './store';
import {debounce} from '../lib/utils';
import {SESSION} from './action-names';

const transactions = new Map();
const updateDebounce = 1000;

export default function(tabId, resourceUrl, applyPatch) {
    var key = getKey(tabId, resourceUrl);
    if (!transactions.has(key)) {
        createTransaction(tabId, resourceUrl);
    }
    transactions.get(key)(applyPatch);
};

function createTransaction(tabId, resourceUrl) {
	var key = getKey(tabId, resourceUrl);

	var transaction = debounce(function(applyPatch) {
		var snapshot;
        console.info('Starting update transaction for', tabId, resourceUrl);
		devtools.getContent(tabId, resourceUrl)
		.then(content => {
			// save patches snapshot and apply them on resource content
			snapshot = getResourcePatches(tabId, resourceUrl);
			if (!snapshot) {
				// session was destroyed or empty patch list, aborting
                console.info('No patches for %s resource, abort', resourceUrl);
				return cancel();
			}

			return Promise.race([
				applyPatch(content, snapshot),
				rejectOnTimeout(10000)
			]);
		})
		.then(response => {
            console.info('Resource patched, try to update content in', tabId, resourceUrl);
			// make sure session still exists and no new patches were added
			var curSnapshot = getResourcePatches(tabId, resourceUrl);
			if (!curSnapshot) {
				// session was destroyed, aborting
				console.info('Session destroyed when patching %s resource, abort', resourceUrl);
				return cancel();
			}

			if (snapshot === curSnapshot) {
				// everything seems fine: we can update DevTools resource
				// and drain patch queue
				dispatch({
					type: SESSION.RESET_RESOURCE_PATCHES,
					uri: resourceUrl,
					tabId
				});
				return devtools.update(tabId, resourceUrl, response.content);
			}
		})
		.catch(err => {
			// in most cases errors are harmless to continue
            console.error('Got error', err);
			// if (err.code !== 'ECANCEL') {
			// }
		})
		.then(() => {
            snapshot = null;
			var patches = getResourcePatches(tabId, resourceUrl);
			if (patches) {
				// there are pending patches, restart transaction
                console.info('Pending patches, restart transaction for', tabId, resourceUrl);
				transaction(applyPatch);
			} else {
                console.info('Transaction complete', tabId, resourceUrl);
				transactions.delete(key);
			}
		});
	}, updateDebounce);
	transactions.set(key, transaction);
	return transaction;
}

function getKey(tabId, resourceUrl) {
	return `${tabId}+${resourceUrl}`;
}

function cancel() {
    var err = new Error('Transaction was cancelled');
    err.code = 'ECANCEL';
    return Promise.reject(err);
}

function rejectOnTimeout(timeout=1000) {
	return new Promise((response, reject) => {
		setTimeout(() => {
			let err = new Error('Timeout');
			err.code = 'ETIMEOUT';
			reject(err);
		}, timeout);
	});
}

function getResourcePatches(tabId, url) {
	var session = getStateValue('sessions')[tabId];
	return session && session.patches.get(url) || null;
}
