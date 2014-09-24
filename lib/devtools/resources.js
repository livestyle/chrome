/**
 * Resource manager for DevTools: handles updates and
 * patching of instected we page resources
 */
define(function(require) {
	var deferred = require('../deferred');
	var utils = require('../utils');
	var client = require('../../node_modules/livestyle-client/index');

	var stylesheets = {};
	var reStylesheet = /\.css$/;

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

	function Resource(reference, content) {
		this.reference = reference;
		this.content = content;
		this.pendingPatches = [];
		this._patching = false;

		this._commit = utils.debounce(function() {
			this.reference.setContent(this.content, true);
		}, 500);
	}

	Resource.prototype = {
		update: function(newContent) {
			this.content = newContent;
			this.reference.setContent(this.content, false);
			this._commit();
		},
		patch: function(patches) {
			if (patches) {
				this.pendingPatches = this.pendingPatches.concat(patches);
			}

			if (!this._patching && this.pendingPatches.length) {
				this._patching = false;
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
			this._patching = false;
			this.update(content);
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

	return {
		applyPendingPatches: function(payload) {
			loadStylesheets.then(function() {
				Object.keys(payload).forEach(function(url) {
					if (url in stylesheets) {
						stylesheets[url].patch(payload.url);
					}
				});
			});
		}
	};
});