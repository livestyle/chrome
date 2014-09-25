/**
 * Resource manager for DevTools: handles updates and
 * patching of instected we page resources
 */
define(function(require) {
	var deferred = require('../deferred');
	var utils = require('../utils');
	var crc32 = require('../crc32');
	var eventMixin = require('../event-mixin');
	var client = require('../../node_modules/livestyle-client/index');

	var stylesheets = {};
	var reStylesheet = /\.css$/;

	/**
	 * Current module definition
	 */
	var module = utils.extend({
		/**
		 * Returns resource by its url
		 * @param {String} url Resource URL
		 * @param {Function} callback Callback invoked when resource 
		 * is fetched from backend
		 */
		get: function(url, callback) {
			loadStylesheets.then(function() {
				callback(stylesheets[url]);
			});
		},
		applyPendingPatches: function(payload) {
			loadStylesheets.then(function() {
				Object.keys(payload).forEach(function(url) {
					if (url in stylesheets) {
						console.log('apply pending patches on', url, payload[url]);
						stylesheets[url].patch(payload[url]);
					}
				});
			});
		}
	}, eventMixin);

	/**
	 * Initial resource loader: retrieves all stylesheet resources
	 * from inspected page and keeps them in `stylesheets` collection
	 * for patching
	 */
	var loadStylesheets = deferred(function() {
		var self = this;
		// load all resources from inspected window
		chrome.devtools.inspectedWindow.getResources(function(resources) {
			resources = resources.filter(function(res) {
				return reStylesheet.test(res.url);
			});
			stylesheets = {};

			var next = function() {
				if (!resources.length) {
					// log('Loaded stylesheets:', Object.keys(stylesheets));
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

	function log() {
		module.trigger('log', Array.prototype.slice.call(arguments, 0));
	}

	function Resource(reference, content) {
		this._content = null;
		this._hash = null;
		this._patching = false;

		this.reference = reference;
		this.content = content;
		this.pendingPatches = [];
		this._commit = utils.debounce(function() {
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
				this._content = value;
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
		log('Raw resource updated', res.url);
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


	// connect to LiveStyle server
	client
	.on('patch', function(data) {
		if (data.uri in stylesheets && data.hash === 'devtools') {
			stylesheets[data.uri].commitPatch(data.content, data.ranges);
		}
	})
	.connect();

	return module;
});