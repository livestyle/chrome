/**
 * Shadow CSS is a concept used to bypass Chrome security restrictions for CSSOM:
 * if a stylesheet is loaded from different origin or 'file:' protocol, you cannot
 * access its `cssRules`. But `insertRule()` and `deleteRule()` works fine though.
 *
 * Here’s how Shadow CSS works:
 * 1. Loads contents of given (security restricted) stylesheet either from
 * DevTools resource (faster, contains most recent changes) or via XHR 
 * (extensions can bypass CORS restrictions).
 * 2. Creates inline style with this stylesheet contents in hidden iframe. This
 * stylesheets always allows access to `cssRules`.
 * 3. Use this inline stylesheet for CSSOM patching. The patching will return 
 * an update plan: a set of `insterRule()` and `deleteRule()` instructions that
 * must be applied to origin stylesheet to get the same result.
 * 4. Blindly apply this update plan to original stylesheet and hope everything
 * works as expected.
 * 5. Automatically keep track of all DevTools Resources updates and keep 
 * shadow CSS in sync.
 */
'use strict';

var host = null;
var shadowCSS = {};

export default function(url) {
	return new Promise(function(resolve, reject) {
		if (url in shadowCSS) {
			return resolve(shadowCSS[url]);
		}

		// is case if no one answers, reject promise
		var _timer = setTimeout(() => {
			var err = new Error(`Unable to fetch ${url}: no response from background page`);
			err.code = 'ESHADOWSTNORESPONSE';
			reject(err);
		}, 5000);

		// fetch stylesheet contents first
		chrome.runtime.sendMessage({name: 'get-stylesheet-content', data: {url}}, resp => {
			if (_timer) {
				cleatTimeout(_timer);
				_timer = null;
			}

			// A stylesheet may be already created with another request
			if (!shadowCSS[url]) {
				if (resp == null) {
					// `null` or `undefined` means error while fetching CSS contents,
					// try again later
					let err = new Error(`Content fetch request for ${url} returned null`);
					err.code 'ESHADOWSTEMPTY';
					return reject(err);
				}

				var style = getHost().createElement('style');
				style.textContent = resp || '';
				getHost().head.appendChild(style);
				shadowCSS[url] = style;
			}

			resolve(shadowCSS[url]);
		});
	});
};

function getHost() {
	if (!host) {
		var iframe = document.createElement('iframe');
		iframe.src = 'about:blank';
		host = iframe.contentDocument;
	}
	return host;
}