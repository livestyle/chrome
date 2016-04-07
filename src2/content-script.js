'use strict';

import * as cssom from 'livestyle-cssom-patcher';
import {default as syncUserStylesheets, isUserStylesheet, createUrl} from './chrome/user-stylesheet';
import shadowCSS from './lib/shadow-css';
import origin from './lib/origin';

var pendingShadowCSSPatches = [];

// disable in-page LiveStyle extension
document.documentElement.setAttribute('data-livestyle-extension', 'available');

chrome.runtime.onMessage.addListener(function(message, sender, callback) {
	// console.log('got message', message);
	if (!message) {
		return;
	}

	var data = message.data;
	switch (message.action) {
		case 'apply-cssom-patch':
			return applyPatches(data.stylesheetUrl, data.patches);
		case 'get-stylesheets':  // deprecated, use `get-tab-info`
			callback(findStyleSheets(document.styleSheets));
			return true;
		case 'create-user-stylesheet-url':
			callback(data.stylesheetId.reduce((out, id) => {
				out[id] = createUrl(id);
				return out;
			}, {}));
			return true;
		case 'sync-user-stylesheets':
			console.log('requested stylesheet sync', message);
			callback(syncUserStylesheets(data.items));
			return true;
		case 'get-origin': // deprecated, use `get-tab-info`
			callback(origin());
			return true;
		case 'get-tab-info':
			callback(getTabInfo());
			return true;
	}
});

function getTabInfo() {
	return {
		url: window.location.href,
		origin: origin(),
		stylesheets: {
			cssom: findStyleSheets(document.styleSheets)
		}
	};
}

function applyPatches(url, patches) {
	if (!url || !patches || !patches.length) {
		return;
	}

	var stylesheets = cssom.stylesheets();
	var originalCSS = stylesheets[url];
	if (!originalCSS) {
		// no such stylessheet, aborting
		return;
	}

	if (originalCSS.cssRules) {
		// console.log('apply patch %o on %o', patches, stylesheets[url]);
		cssom.patch(stylesheets[url], patches);
	} else {
		// Empty `cssRules` property means security restrictions applied
		// by Chrome. Try Shadow CSS
		var pending = !!pendingShadowCSSPatches.length;
		pendingShadowCSSPatches = pendingShadowCSSPatches.concat(patches);
		if (pending) {
			// there’s already a request for patching shadow, simply delegate
			// new patches to it
			return;
		}

		shadowCSS(url).then(css => {
			// Empty pending patches as soon as possible so new patching request
			// can trigger new patching session even there was an error during
			// CSSOM syncing
			var patches = pendingShadowCSSPatches.slice(0);
			pendingShadowCSSPatches.length = 0;
			cssom.patch(css, patches).forEach(item => {
				if (item.action === 'delete') {
					originalCSS.deleteRule(item.index);
				} else if (item.action === 'insert') {
					originalCSS.insertRule(item.value, item.index);
				} else if (item.action === 'update') {
					originalCSS.deleteRule(item.index);
					originalCSS.insertRule(item.value, item.index);
				}
			});
		}, err => console.error(err));
	}
}

/**
 * Findes all stylesheets in given context, including
 * nested `@import`s
 * @param  {StyleSheetList} ctx List of stylesheets to scan
 * @return {Array} Array of stylesheet URLs
 */
function findStyleSheets(ctx, out) {
	out = out || [];
	for (var i = 0, il = ctx.length, url, item; i < il; i++) {
		item = ctx[i];
		url = item.href;
		if (~out.indexOf(url) || isUserStylesheet(item.ownerNode)) {
			// stylesheet already added or it’s a user stylesheet
			continue;
		}

		if (url) {
			out.push(url);
		}

		// find @import rules
		if (item.cssRules) {
			for (var j = 0, jl = item.cssRules.length; j < jl; j++) {
				if (item.cssRules[j].type == 3) {
					findStyleSheets([item.cssRules[j].styleSheet], out);
				}
			}
		}
	}

	return out;
}
