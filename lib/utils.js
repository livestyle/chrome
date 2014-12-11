if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	return {
		/**
		 * Extend given object with properties from other objects
		 * @param  {Object} obj
		 * @return {Object}
		 */
		extend: function(obj) {
			for (var i = 1, il = arguments.length, ctx; i < il; i++) {
				if (ctx = arguments[i]) {
					Object.keys(ctx).forEach(function(key) {
						obj[key] = ctx[key];
					});
				}
			}
			return obj;
		},

		copy: function(obj) {
			return this.extend({}, obj);
		},

		/**
		 * Returns copy of given array with unique values 
		 * @param {Array} arr
		 * @return {Array}
		 */
		unique: function(arr) {
			var lookup = [];
			return arr.filter(function(val) {
				if (lookup.indexOf(val) < 0) {
					lookup.push(val);
					return true;
				}
			});
		},

		/**
		 * Simple class inheritance
		 * @param {Function} child Child class
		 * @param {Function} base Base class
		 * @param {Object} ... Additional object with properties
		 * that will be added to `child` prototype
		 * @return {Object}
		 */
		inherit: function(child, base) {
			// var Surrogate = function() {
			// 	this.constructor = child;
			// 	this.super = base;
			// };
			// Surrogate.prototype = base.prototype;
			// child.prototype = new Surrogate;

			child.prototype = Object.create(base.prototype);
			child.prototype.constructor = child;
			child.__super__ = base.prototype;

			for (var i = 2, il = arguments.length; i < il; i++) {
				this.extend(child.prototype, arguments[i]);
			}

			return child;
		},

		/**
		 * Returns a function, that, as long as it continues to be invoked, will not
  		 * be triggered. The function will be called after it stops being called for
  		 * N milliseconds. If `immediate` is passed, trigger the function on the
  		 * leading edge, instead of the trailing.
  		 * 
  		 * @src underscore.js
  		 * 
		 * @param  {Function} func
		 * @param  {Number} wait
		 * @param  {Boolean} immediate
		 * @return {Function}
		 */
		debounce: function(func, wait, immediate) {
			var timeout, args, context, timestamp, result;

			var later = function() {
				var last = Date.now() - timestamp;

				if (last < wait && last >= 0) {
					timeout = setTimeout(later, wait - last);
				} else {
					timeout = null;
					if (!immediate) {
						result = func.apply(context, args);
						if (!timeout) context = args = null;
					}
				}
			};

			return function() {
				context = this;
				args = arguments;
				timestamp = Date.now();
				var callNow = immediate && !timeout;
				if (!timeout) timeout = setTimeout(later, wait);
				if (callNow) {
					result = func.apply(context, args);
					context = args = null;
				}

				return result;
			};
		},

		/**
		 * Returns string representation for given node path
		 * @param {Array} nodePath
		 * @type {String}
		 */
		stringifyPath: function(nodePath) {
			return nodePath.map(function(component) {
				return component[0] + (component[1] > 1 ? '|' + component[1] : '');
			}).join(' / ');
		},

		/**
		 * Returns string representation of given patch JSON
		 * @param {Object} patch
		 * @type {String}
		 */
		stringifyPatch: function(patch) {
			var str = this.stringifyPath(patch.path) + ' {\n' + 
				patch.update.map(function(prop) {
					return '  ' + prop.name + ': ' + prop.value + ';\n';
				}).join('') +
				patch.remove.map(function(prop) {
					return '  /* ' + prop.name + ': ' + prop.value + '; */\n';
				}).join('') +
				'}';

			if (patch.action === 'remove') {
				str = '/* remove: ' + this.stringifyPath(patch.path) + ' */';
			}

			if (patch.hints && patch.hints.length) {
				var hint = patch.hints[patch.hints.length - 1];
				var self = this;

				var before = (hint.before || []).map(function(p) {
					return self.stringifyPath([p]);
				}).join(' / ');

				var after = (hint.after || []).map(function(p) {
					return self.stringifyPath([p]);
				}).join(' / ');

				if (before) {
					str = '/** before: ' + before + ' */\n' + str;
				}

				if (after) {
					str += '\n/** after: ' + after + ' */\n';
				}
			}

			return str.trim();
		}
	};
});