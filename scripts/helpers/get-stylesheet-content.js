/**
 * Fetches content of given stylesheet URL by any possible way: either from
 * DevTools resource (faster, contains most recent version) or via XHR
 */
'use strict';
import * as devtools from '../controllers/devtools';

export default function(url, tabId, callback) {
	if (typeof tabId === 'function') {
		callback = tabId;
		tabId = null;
	}

	var p;
	if (tabId && devtools.isOpenedForTab(tabId)) {
		p = devtools.stylesheetContent(tabId, url);
	} else {
		p = load(url);
	}

	p.then(callback, err => {
		console.error('Error fetching %s stylesheet content', url, err);
		callback(null);
	});
};

function load(url) {
	// no `fetch` here since it doesn’t support 'file:' protocol
	return new Promise(function(resolve, reject) {
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				if (xhr.status < 300) {
					resolve(xhr.responseText);
				} else {
					var err = new Error(`Unable to fetch ${url}: received ${xhr.status} code`);
					err.code = xhr.status;
					reject(new Error(err));
				}
			}
		};
		xhr.open('GET', url, true);
		xhr.send();
	});
}

