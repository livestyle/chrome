/**
 * Fetches content of given stylesheet URL by any possible way: either from
 * DevTools resource (faster, contains most recent version) or via XHR
 */
'use strict';
import {getStateValue} from '../app/store';

export default function(tabId, url) {
	var session = getStateValue('sessions')[tabId];
	if (session && session.devtoolsStylesheets && session.devtoolsStylesheets.has(url)) {
		return Promise.resolve(session.devtoolsStylesheets.get(url));
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
