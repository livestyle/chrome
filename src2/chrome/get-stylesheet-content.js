/**
 * Fetches content of given stylesheet URL by any possible way: either from
 * DevTools resource (faster, contains most recent version) or via XHR
 */
'use strict';
import app from '../lib/app';

export default function(tabId, url) {
	var tab = app.getStateValue('tabs').get(tabId);
	if (tab && tab.stylesheets.devtools && tab.stylesheets.devtools.has(url)) {
		return Promise.resolve(tab.stylesheets.devtools.get(url));
	}
	return load(url);
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
