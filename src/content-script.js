'use strict';

import * as cssom from 'livestyle-cssom-patcher';
import shadowCSS from './lib/shadow-css';
import origin from './lib/origin';

var pendingShadowCSSPatches = [];

function $$(sel, context) {
	var items = (context || document).querySelectorAll(sel);
	return Array.prototype.slice.call(items, 0);
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

function userStylesheets() {
	return $$('link[rel="stylesheet"]').filter(link => !!lsId(link));
}

/**
 * Creates `amount` new stylesheets on current page
 * @param  {Number} amount How many stylesheets should be created
 * @returns {Array} Array of stylesheet URLs
 */
function generateUserStylesheets(url) {
	if (!Array.isArray(url)) {
		url = [url];
	}

	var result = {};
	url.forEach(function(internalUrl) {
		console.log('Creating stylesheet', internalUrl);
		var uss = createUserStylesheet();
		uss.dataset.livestyleId = internalUrl;
		document.head.appendChild(uss);
		result[internalUrl] = uss.href;
	});

	return result;
}

function createUserStylesheet(content) {
	var blob = new Blob([content || ''], {type: 'text/css'});
	var url = URL.createObjectURL(blob);
	var link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = url;
	return link;
}

/**
 * Removes stylesheet with given URL (blob or internal LiveStyle ID)
 * @param  {String} url
 */
function removeUserStylesheet(url) {
	console.log('Removing stylesheet', url);
	userStylesheets().forEach(function(link) {
		if (link.href === url || lsId(link) == url) {
			removeLink(link);
		}
	});
}

function removeLink(link) {
	link.parentNode.removeChild(link);
	window.URL.revokeObjectURL(link.href);
}

/**
 * Validates given user stylesheets: adds missing and removes redundant ones
 * @param  {String} url Internal URL or array of URLs
 * @return {Object}     Hash where key is given URL and value if stylesheets’
 * blob URL
 */
function validateUserStylesheets(url) {
	var result = {};
	var cur = userStylesheets();
	if (!Array.isArray(url)) {
		url = [url];
	}

	// remove redundant
	var exists = {};
	cur.forEach(function(item) {
		var id = lsId(item);
		if (!~url.indexOf(id)) {
			removeLink(item);
		} else {
			exists[id] = item.href;
		}
	});

	// create missing
	var missing = generateUserStylesheets(url.filter(item => !(item in exists)));

	// re-create result hash with keys in right order
	var result = {};
	url.forEach(function(item) {
		result[item] = exists[item] ||  missing[item];
	});
	return result;
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
		if (~out.indexOf(url) || lsId(item.ownerNode)) {
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

function lsId(node) {
	var dataset = (node && node.dataset) || {};
	return dataset.livestyleId;
}

// disable in-page LiveStyle extension
document.documentElement.setAttribute('data-livestyle-extension', 'available');

chrome.runtime.onMessage.addListener(function(message, sender, callback) {
	console.log('got message', message);
	if (!message) {
		return;
	}

	var data = message.data;
	switch (message.action) {
		case 'apply-cssom-patch':
			return applyPatches(data.stylesheetUrl, data.patches);
		case 'create-user-stylesheet':
			callback(generateUserStylesheets(data.url));
			return true;
		case 'remove-user-stylesheet':
			return removeUserStylesheet(data.url);
		case 'validate-user-stylesheet':
			callback(validateUserStylesheets(data.url));
			return true;
		case 'get-stylesheets':
			console.log('requested stylesteets');
			console.log(findStyleSheets(document.styleSheets));
			callback(findStyleSheets(document.styleSheets));
			return true;
		case 'get-origin':
			callback(origin());
			return true;
	}
});
