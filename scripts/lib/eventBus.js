/**
 * Central event bus: a wrapper for Chrome messaging API
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var utils = require('./utils');
	var eventMixin = require('./event-mixin');

	var eventSplitter = /\s+/;
	var slice = Array.prototype.slice;
	var errCommand = new Error('No handler for command');

	var dispatcher = utils.extend({}, eventMixin, {
		emit: function(events) {
			var event, rest;
			events = events.split(eventSplitter);
			rest = slice.call(arguments, 1);
			while (event = events.shift()) {
				chrome.runtime.sendMessage({
					name: event,
					args: rest
				});
			}
		},
		/**
		 * Unlike `emit` method, `command` expects that event handler
		 * will invoke given callback function, optionally with
		 * response data. But it’s possible that no one can handle 
		 * given command: in this case, `callback` will be executed
		 * after some timeout with single `errCommand` argument.
		 * @param  {String} name Command to execute
		 */
		command: function(name) {
			var ctx = this;
			var rest = slice.call(arguments, 1);
			var callback = rest.pop();
			if (typeof callback !== 'function') {
				throw new Error('The last argument must be a function');
			}

			var fulfilled = false, timerId;
			var done = function() {
				if (!fulfilled) {
					fulfilled = true;
					if (timerId) {
						clearTimeout(timerId);
					}
					var args = [null].concat(arguments);
					callback.apply(ctx, args);
				}
			};
			var fail = function() {
				if (!fulfilled) {
					fulfilled = true;
					callback.call(ctx, errCommand);
				}
			};

			timerId = setTimeout(fail, 500);
			chrome.runtime.sendMessage({
				name: event,
				args: rest
			}, done);
		}
	});

	chrome.runtime.onMessage.addListener(function(payload) {
		if (typeof payload !== 'object' || !payload[name]) {
			return;
		}

		var args = [payload.name].concat(payload.args || []);
		eventMixin.emit.apply(dispatcher, args);
	});


	return dispatcher;
});