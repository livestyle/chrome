'use strict';

export function $(selector, context=document) {
	return context.querySelector(selector);
}

export function $$(selector, context=document) {
	return toArray(context.querySelectorAll(selector));
}

export function toArray(obj, ix=0) {
	return Array.prototype.slice.call(obj, 0);
}

export function toDom(html) {
	var div = document.createElement('div');
	div.innerHTML = html;
	var result = div.firstChild;
	div.removeChild(result);
	return result;
}

/**
 * Extend given object with properties from other objects
 * @param  {Object} obj
 * @return {Object}
 */
export function extend(obj, ...args) {
	args.forEach(arg => {
		if (arg) {
			for (var key in arg) if (arg.hasOwnProperty(key)) {
				obj[key] = arg[key];
			}
		}
	});
	return obj;
}

export function copy(...args) {
	return extend({}, ...args);
}

export function closest(elem, sel) {
	while (elem && elem !== document) {
		if (elem.matches && elem.matches(sel)) {
			return elem;
		}
		elem = elem.parentNode;
	}
}

/**
 * Returns copy of given array with unique values 
 * @param {Array} arr
 * @return {Array}
 */
export function unique(arr) {
	var lookup = [];
	return arr.filter(val => {
		if (lookup.indexOf(val) < 0) {
			lookup.push(val);
			return true;
		}
	});
}

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
export function debounce(func, wait, immediate) {
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
}

/**
 * Returns string representation for given node path
 * @param {Array} nodePath
 * @type {String}
 */
export function stringifyPath(nodePath) {
	return nodePath.map(c => c[0] + (c[1] > 1 ? '|' + c[1] : '')).join(' / ');
}

/**
 * Returns string representation of given patch JSON
 * @param {Object} patch
 * @type {String}
 */
export function stringifyPatch(patch) {
	var str = this.stringifyPath(patch.path) + ' {\n' + 
		patch.update.map(prop => `  ${prop.name}: ${prop.value};\n`).join('') +
		patch.remove.map(prop => `  /* ${prop.name}: ${prop.value}; */\n`).join('') +
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
			str = `/** before: ${before} */\n${str}`;
		}

		if (after) {
			str += `\n/** after: ${after} */\n`;
		}
	}

	return str.trim();
}