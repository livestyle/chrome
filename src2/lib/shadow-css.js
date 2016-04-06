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
			return resolve(shadowCSS[url].sheet);
		}

		// reject promise if no answer for too long
		var _timer = setTimeout(() => {
			reject(makeError('ESHADOWSTNORESPONSE', `Unable to fetch ${url}: no response from background page`));
		}, 5000);

		// fetch stylesheet contents first
		chrome.runtime.sendMessage({name: 'get-stylesheet-content', data: {url}}, resp => {
			if (_timer) {
				clearTimeout(_timer);
				_timer = null;
			}

			// A stylesheet may be already created with another request
			if (!shadowCSS[url]) {
				if (resp == null) {
					// `null` or `undefined` means error while fetching CSS contents,
					// try again later
					return reject(makeError('ESHADOWSTEMPTY', `Content fetch request for ${url} returned null`));
				}
				
				shadowCSS[url] = createShadowStylesheet(resp);
				shadowCSS[url].dataset.href = url;
			}

			resolve(shadowCSS[url].sheet);
		});
	});
};

function getHost() {
	if (!host) {
		var iframe = document.createElement('iframe');
		iframe.style.cssText = 'width:1px;height:1px;border:0;position:absolute;display:none';
		iframe.id = 'livestyle-shadow-css';
		var content = new Blob(['<html><head></head></html>'], {type: 'text/html'});
		iframe.src = URL.createObjectURL(content);
		document.body.appendChild(iframe);
		host = iframe.contentDocument;
	}
	return host;
}

function createShadowStylesheet(content) {
	var style = getHost().createElement('style');
	getHost().head.appendChild(style);
	if (style.sheet) {
		style.sheet.disabled = true;
	}
	style.textContent = content || '';
	return style;
}

function makeError(code, message) {
	var err = new Error(message || code);
	err.code = code;
	return err;
}

// listen to DevTools Resource updates
chrome.runtime.onMessage.addListener(function(message) {
	if (message && message.name === 'resource-updated' && shadowCSS[message.data.url]) {
		var data = message.data;
		shadowCSS[data.url].textContent = data.content;
	}
});