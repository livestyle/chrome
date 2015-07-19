'use strict';

import * as cssom from 'livestyle-cssom-patcher';

function $$(sel, context) {
	var items = (context || document).querySelectorAll(sel);
	return Array.prototype.slice.call(items, 0);
}

function applyPatches(url, patches) {
	if (!url || !patches || !patches.length) {
		return;
	}

	var stylesheets = cssom.stylesheets();
	if (stylesheets[url]) {
		// console.log('apply patch %o on %o', patches, stylesheets[url]);
		cssom.patch(stylesheets[url], patches);
	}
}

function userStylesheets() {
	return $$('link[rel="stylesheet"]').filter(link => !!link.dataset.livestyleId);
}

/**
 * Creates `amount` new stylesheets on current page
 * @param  {Number} amount How many stylesheets should be created
 * @returns {Array} Array of stylesheet URLs
 */
function createUserStylesheet(url) {
	if (!Array.isArray(url)) {
		url = [url];
	}

	var result = {};
	url.forEach(function(internalUrl) {
		console.log('Creating stylesheet', internalUrl);
		var blob = new Blob([''], {type: 'text/css'});
		var url = window.URL.createObjectURL(blob);
		var link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = url;
		link.dataset.livestyleId = internalUrl;
		document.head.appendChild(link);
		result[internalUrl] = url;
	});

	return result;
}

/**
 * Removes stylesheet with given URL (blob or internal LiveStyle ID)
 * @param  {String} url
 */
function removeUserStylesheet(url) {
	console.log('Removing stylesheet', url);
	userStylesheets().forEach(function(link) {
		if (link.href === url || link.dataset.livestyleId == url) {
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
		if (!~url.indexOf(item.dataset.livestyleId)) {
			removeLink(item);
		} else {
			exists[item.dataset.livestyleId] = item.href;
		}
	});

	// create missing
	var missing = createUserStylesheet(url.filter(function(item) {
		return !(item in exists);
	}));

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
		if (~out.indexOf(url) || (item.ownerNode && item.ownerNode.dataset.livestyleId)) {
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

// disable in-page LiveStyle extension
document.documentElement.setAttribute('data-livestyle-extension', 'available');

chrome.runtime.onMessage.addListener(function(message, sender, callback) {
	if (!message) {
		return;
	}

	var data = message.data;
	switch (message.name) {
		case 'apply-cssom-patch':
			return applyPatches(data.stylesheetUrl, data.patches);
		case 'create-user-stylesheet':
			callback(createUserStylesheet(data.url));
			return true;
		case 'remove-user-stylesheet':
			return removeUserStylesheet(data.url);
		case 'validate-user-stylesheet':
			callback(validateUserStylesheets(data.url));
			return true;
		case 'get-stylesheets':
			callback(findStyleSheets(document.styleSheets));
			return true;
	}
});