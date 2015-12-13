/**
 * Resource manager for DevTools: handles updates and
 * patching of instected we page resources
 */
'use strict';

import client from 'livestyle-client';
import {debounce} from '../lib/utils';
import crc32 from '../lib/crc32';
import EventEmitter from '../lib/event-emitter';

var stylesheets = {};
var reStylesheet = /^blob:|\.css$/;
var emitter = new EventEmitter();

var on = emitter.on.bind(emitter);
var off = emitter.off.bind(emitter);
var emit = emitter.emit.bind(emitter);

/**
 * Initial resource loader: retrieves all stylesheet resources
 * from inspected page and keeps them in `stylesheets` collection
 * for patching
 */
var loadStylesheets = initStylesheetLoader();

export {on, off, emit};

/**
 * Returns resource by its url
 * @param {String} url Resource URL
 * @param {Function} callback Callback invoked when resource 
 * is fetched from backend
 */
export function get(url, callback) {
	log('Requested', url);
	loadStylesheets.then(function() {
		callback(stylesheets[url]);
	});
}

export function applyPendingPatches(payload) {
	loadStylesheets.then(function() {
		Object.keys(payload).forEach(function(url) {
			if (url in stylesheets) {
				log('Apply pending patches on', url, payload[url]);
				stylesheets[url].patch(payload[url]);
			}
		});
	});
}

/**
 * Returns list of URLs of all available stylesheets
 */
export function list(callback) {
	loadStylesheets.then(function() {
		callback(Object.keys(stylesheets));
	});
}

export function reset() {
	// explicitly break reference for Resource
	Object.keys(stylesheets).forEach(key => stylesheets[key].reset());
	stylesheets = {};
	loadStylesheets = initStylesheetLoader();
}

function initStylesheetLoader() {
	return new Promise(function(resolve, reject) {
		chrome.devtools.inspectedWindow.getResources(function(resources) {
			resources = resources.filter(isStylesheet);
			stylesheets = {};

			var next = function() {
				if (!resources.length) {
					log('Loaded stylesheets:', Object.keys(stylesheets));
					return resolve(stylesheets);
				}

				var res = resources.pop();
				res.getContent(function(content) {
					stylesheets[res.url] = new Resource(res, content);
					next();
				});
			};
			next();
		});
	});
}

function isStylesheet(res) {
	return res.type ? res.type === 'stylesheet' : isStylesheetURL(res.url);
}

function isStylesheetURL(url) {
	return reStylesheet.test(url.split('?')[0]);
}

function log() {
	emit('log', Array.prototype.slice.call(arguments, 0));
}

class Resource {
	constructor(reference, content) {
		this._content = '';
		this._hash = null;
		this._patching = false;
		this._commitTimeout = null;

		this.reference = reference;
		this.content = content;
		this.pendingPatches = [];
		this._setInitialContent();
	}

	get url() {
		return this.reference.url;
	}

	get content() {
		return this._content;
	}

	set content(value) {
		this._content = value || '';
		this._hash = null;
	}

	get hash() {
		if (!this._hash) {
			this._hash = crc32(this.content);
		}
		return this._hash;
	}

	get isPatching() {
		return this._patching;
	}

	_setInitialContent() {
		client.send('initial-content', {
			uri: this.url,
			syntax: 'css',
			hash: this.hash,
			content: this.content
		});
	}

	patch(patches) {
		if (patches) {
			this.pendingPatches = this.pendingPatches.concat(patches);
		}

		log('Patch request for', this.reference.url);
		if (!this.isPatching && this.pendingPatches.length) {
			this._patching = true;
			log('Applying patch on', this.url);
			client.send('apply-patch', {
				uri: this.url,
				syntax: 'css',
				hash: 'devtools',
				content: this.content,
				patches: this.pendingPatches
			});
			this.pendingPatches = [];
		}
	}

	commitPatch(content, ranges) {
		// Resource commiting is very slow operation, especially combined
		// with preceding `apply-patch`/`patch` operations. If we commit 
		// resource upon request, we can introduce “jank”: it may revert 
		// changes already applied by much faster CSSOM updater.
		// Thus we have to postpone resource commiting as mush as possible to
		// apply only the most recent updates
		if (this._commitTimeout) {
			clearTimeout(this._commitTimeout);
		}

		log('Queueing patch commit for', this.url);
		this._commitTimeout = setTimeout(() => {
			this._commitTimeout = null;
			if (this.pendingPatches.length) {
				log('Pending patches, cancel current update for', this.url);
				// there are more recent updates waiting to be applied, skip 
				// current update to not revert CSSOM updates and apply pending
				// patches since last patch() request
				this._patching = false;
				this.content = content;
				return this.patch();
			}

			log('Request resource commit for', this.url);
			this.reference.setContent(content, true, err => {
				if (!err || err.code === 'OK') {
					log('Resource committed successfully for', this.url);
					this.content = content;
					this._setInitialContent();
				} else {
					log('Error commiting new content for', this.url, err);
				}

				// apply pending patches since last patch() request
				this._patching = false;
				this.patch();
			});
		}, 300);
	}

	reset() {
		this.reference = this._content = this.pendingPatches = null;
		if (this._commitTimeout) {
			clearTimeout(this._commitTimeout);
		}
	}
}

chrome.devtools.inspectedWindow.onResourceContentCommitted.addListener(function(res, content) {
	var stylesheet = stylesheets[res.url];
	if (stylesheet && !stylesheet.isPatching && stylesheet.content !== content) {
		// This update is coming from user update
		log('Resource committed, request diff for', res.url);
		stylesheet.content = content;
		client.send('calculate-diff', {
			uri: res.url,
			syntax: 'css',
			content: content,
			hash: crc32(content)
		});
		emit('update', res.url, content);
	}
});

chrome.devtools.inspectedWindow.onResourceAdded.addListener(function(res) {
	if (isStylesheet(res) && !stylesheets[res.url]) {
		res.getContent(function(content) {
			stylesheets[res.url] = new Resource(res, content);
		});
	}
});


// connect to LiveStyle server
client.on('patch', function(data) {
	if (data.uri in stylesheets && data.hash === 'devtools') {
		stylesheets[data.uri].commitPatch(data.content, data.ranges);
	}
})
.connect();