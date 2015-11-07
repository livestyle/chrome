/**
 * A content script for extracting page’s URL origin. Mostly used for getting
 * origin of documents with `file:` protocol for Remote View.
 * By default it’s a filesystem root, so if RV will open a public HTTP server
 * pointing filesystem root, it’s gonna be a huge security breach. This module
 * will try to find a largest common dir prefix for resources from current
 * page.
 */
'use strict';

const reIsFile = /^file:/;

export default function() {
	var origin = location.origin;
	if (/^https?:/.test(origin)) {
		return origin;
	}

	if (reIsFile.test(origin)) {
		return findFileOrigin();
	}

	return null;
};

function $$(sel, context) {
	var items = (context || document).querySelectorAll(sel);
	return Array.prototype.slice.call(items, 0);
}

function findFileOrigin() {
	return $$('link, img, a, video, audio, script, iframe').concat([location])
	.map(elem => elem.currentSrc || elem.src || elem.href)
	.filter(url => url && reIsFile.test(url))
	.map(url => {
		// remove file from url and normalize it
		var parts = url.replace(/^file:\/\//, '').split('/');
		if (/\.[\w-]+$/.test(parts[parts.length - 1] || '')) {
			parts.pop();
		}
		return 'file://' + parts.join('/').replace(/\/+$/, '');
	})
	.reduce((prev, cur) => cur.length < prev.length ? cur : prev);
}