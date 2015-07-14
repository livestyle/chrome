/**
 * Resource manager for DevTools: handles updates and
 * patching of instected we page resources
 */
'use strict';

import client from 'livestyle-client';
import deferred from '../lib/deferred';
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
	Object.keys(stylesheets).forEach(function(key) {
		stylesheets[key].reference = null;
	});
	stylesheets = {};
	loadStylesheets = initStylesheetLoader();
}

function initStylesheetLoader() {
	return deferred(function() {
		var self = this;
		// load all resources from inspected window
		chrome.devtools.inspectedWindow.getResources(function(resources) {
			resources = resources.filter(function(res) {
				return isStylesheetURL(res.url);
			});
			stylesheets = {};

			var next = function() {
				if (!resources.length) {
					log('Loaded stylesheets:', Object.keys(stylesheets));
					return self.resolve(stylesheets);
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

function isStylesheetURL(url) {
	return reStylesheet.test(url.split('?')[0]);
}

function log() {
	emit('log', Array.prototype.slice.call(arguments, 0));
}

function Resource(reference, content) {
	this._content = '';
	this._hash = null;
	this._patching = false;

	this.reference = reference;
	this.content = content;
	this.pendingPatches = [];
	this._commit = debounce(function() {
		log('Commit content for', this.reference.url);
		this.reference.setContent(this.content, true);
	}, 500);
	this._setInitialContent();
}

Resource.prototype = {
	_setInitialContent: function() {
		client.send('initial-content', {
			uri: this.url,
			syntax: 'css',
			hash: this.hash,
			content: this.content
		});
	},
	update: function(newContent) {
		log('Update content for', this.reference.url);
		this.content = newContent;
		this._setInitialContent();
		this.reference.setContent(this.content, false);
		this._commit();
	},
	patch: function(patches) {
		if (patches) {
			this.pendingPatches = this.pendingPatches.concat(patches);
		}

		log('Patch request for', this.reference.url);
		if (!this._patching && this.pendingPatches.length) {
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
	},
	commitPatch: function(content, ranges) {
		this.update(content);
		this._patching = false;
		// apply patches batched since last `patch()` call
		this.patch();
	}
};

Object.defineProperties(Resource.prototype, {
	url: {
		enumerable: true,
		get: function() {
			return this.reference.url;
		}
	},
	content: {
		enumerable: true,
		get: function() {
			return this._content;
		},
		set: function(value) {
			this._content = value || '';
			this._hash = null;
		}
	},
	hash: {
		enumerable: true,
		get: function() {
			return this._hash || (this._hash = crc32(this.content));
		}
	}
});

chrome.devtools.inspectedWindow.onResourceContentCommitted.addListener(function(res, content) {
	var stylesheet = stylesheets[res.url];
	if (stylesheet && stylesheet.content !== content) {
		// This update is coming from user update
		log('Resource committed, request diff for', res.url);
		client.send('calculate-diff', {
			uri: res.url,
			syntax: 'css',
			content: content,
			hash: crc32(content)
		});
		stylesheet.content = content;
	}
});

chrome.devtools.inspectedWindow.onResourceAdded.addListener(function(res) {
	if (reStylesheet.test(res.url) && !stylesheets[res.url]) {
		log('Added resource', res.url);
		res.getContent(function(content) {
			stylesheets[res.url] = new Resource(res, content);
		});
	}
});


// connect to LiveStyle server
client
.on('patch', function(data) {
	if (data.uri in stylesheets && data.hash === 'devtools') {
		stylesheets[data.uri].commitPatch(data.content, data.ranges);
	}
})
.connect();
