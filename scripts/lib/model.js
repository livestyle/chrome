/**
 * A simple model object: a very simplified version of 
 * Backbone.Model
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require) {
	var utils = require('./utils');
	var eventMixin = require('./event-mixin');
	var hasOwnProperty = Object.prototype.hasOwnProperty;

	function has(obj, key) {
		return obj != null && hasOwnProperty.call(obj, key);
	}

	// Perform a deep comparison to check if two objects are equal.
	function isEqual(a, b) {
		return eq(a, b, [], []);
	}

	// Is a given array, string, or object empty?
	// An "empty" object has no enumerable own-properties.
	function isEmpty(obj) {
		if (obj == null) {
			return true;
		}
		if (Array.isArray(obj) || typeof obj === 'string') {
			return obj.length === 0;
		}
		for (var key in obj) if (has(obj, key)) {
			return false;
		}

		return true;
	}

	// Internal recursive comparison function for `isEqual`.
	function eq(a, b, aStack, bStack) {
		// Identical objects are equal. `0 === -0`, but they aren't identical.
		// See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
		if (a === b) return a !== 0 || 1 / a === 1 / b;
		// A strict comparison is necessary because `null == undefined`.
		if (a == null || b == null) return a === b;

		// Compare `[[Class]]` names.
		var className = toString.call(a);
		if (className !== toString.call(b)) return false;
		switch (className) {
			// Strings, numbers, regular expressions, dates, and booleans are compared by value.
			case '[object RegExp]':
				// RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
			case '[object String]':
				// Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
				// equivalent to `new String("5")`.
				return '' + a === '' + b;
			case '[object Number]':
				// `NaN`s are equivalent, but non-reflexive.
				// Object(NaN) is equivalent to NaN
				if (+a !== +a) return +b !== +b;
				// An `egal` comparison is performed for other numeric values.
				return +a === 0 ? 1 / +a === 1 / b : +a === +b;
			case '[object Date]':
			case '[object Boolean]':
				// Coerce dates and booleans to numeric primitive values. Dates are compared by their
				// millisecond representations. Note that invalid dates with millisecond representations
				// of `NaN` are not equivalent.
				return +a === +b;
		}
		if (typeof a != 'object' || typeof b != 'object') return false;
		// Assume equality for cyclic structures. The algorithm for detecting cyclic
		// structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
		var length = aStack.length;
		while (length--) {
			// Linear search. Performance is inversely proportional to the number of
			// unique nested structures.
			if (aStack[length] === a) return bStack[length] === b;
		}
		// Objects with different constructors are not equivalent, but `Object`s
		// from different frames are.
		var aCtor = a.constructor, bCtor = b.constructor;
		if (
			aCtor !== bCtor &&
			// Handle Object.create(x) cases
			'constructor' in a && 'constructor' in b &&
			!(typeof aCtor === 'function' && aCtor instanceof aCtor &&
				typeof bCtor === 'function' && bCtor instanceof bCtor)
		) {
			return false;
		}
		// Add the first object to the stack of traversed objects.
		aStack.push(a);
		bStack.push(b);
		var size, result;
		// Recursively compare objects and arrays.
		if (className === '[object Array]') {
			// Compare array lengths to determine if a deep comparison is necessary.
			size = a.length;
			result = size === b.length;
			if (result) {
				// Deep compare the contents, ignoring non-numeric properties.
				while (size--) {
					if (!(result = eq(a[size], b[size], aStack, bStack))) break;
				}
			}
		} else {
			// Deep compare objects.
			var keys = Object.keys(a), key;
			size = keys.length;
			// Ensure that both objects contain the same number of properties before comparing deep equality.
			result = Object.keys(b).length === size;
			if (result) {
				while (size--) {
					// Deep compare each member
					key = keys[size];
					if (!(result = has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
				}
			}
		}
		// Remove the first object from the stack of traversed objects.
		aStack.pop();
		bStack.pop();
		return result;
	};

	function Model() {
		if (!(this instanceof Model)) {
			return new Model();
		}
		this.attributes = {};
	}

	Model.prototype = {
		get: function(key) {
			return this.attributes[key];
		},

		set: function(key, val, options) {
			var attr, attrs, unset, changes, silent, changing, prev, current;
			if (key == null) {
				return this;
			}

			// Handle both `"key", value` and `{key: value}` -style arguments.
			if (typeof key === 'object') {
				attrs = key;
				options = val;
			} else {
				(attrs = {})[key] = val;
			}

			options || (options = {});

			// Extract attributes and options.
			unset           = options.unset;
			silent          = options.silent;
			changes         = [];
			changing        = this._changing;
			this._changing  = true;

			if (!changing) {
				this._previousAttributes = utils.extend({}, this.attributes);
				this.changed = {};
			}
			current = this.attributes;
			prev = this._previousAttributes;

			// For each `set` attribute, update or delete the current value.
			for (attr in attrs) {
				val = attrs[attr];
				if (!isEqual(current[attr], val)) {
					changes.push(attr);
				}
				if (!isEqual(prev[attr], val)) {
					this.changed[attr] = val;
				} else {
					delete this.changed[attr];
				}
				unset ? delete current[attr] : current[attr] = val;
			}

			// Trigger all relevant attribute changes.
			if (!silent) {
				if (changes.length) {
					this._pending = options;
				}
				for (var i = 0, l = changes.length; i < l; i++) {
					this.trigger('change:' + changes[i], this, current[changes[i]], options);
				}
			}

			// You might be wondering why there's a `while` loop here. Changes can
			// be recursively nested within `"change"` events.
			if (changing) {
				return this;
			}

			if (!silent) {
				while (this._pending) {
					options = this._pending;
					this._pending = false;
					this.trigger('change', this, options);
				}
			}

			this._pending = false;
			this._changing = false;
			return this;
		},

		// Remove an attribute from the model, firing `"change"`. `unset` is a noop
		// if the attribute doesn't exist.
		unset: function(attr, options) {
			return this.set(attr, void 0, utils.extend({}, options, {unset: true}));
		},

		// Clear all attributes on the model, firing `"change"`.
		clear: function(options) {
			var attrs = {};
			for (var key in this.attributes) {
				attrs[key] = void 0;
			}
			return this.set(attrs, utils.extend({}, options, {unset: true}));
		},

		// Determine if the model has changed since the last `"change"` event.
		// If you specify an attribute name, determine if that attribute has changed.
		hasChanged: function(attr) {
			if (attr == null) {
				return !isEmpty(this.changed);
			}
			return has(this.changed, attr);
		},

		toJSON: function() {
			return utils.extend({}, this.attributes);
		},

		destroy: function() {
			this.off();
		}
	};

	utils.extend(Model.prototype, eventMixin);
	return Model;
});