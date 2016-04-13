'use strict';

/**
 * Returns copy of given array with unique values
 * @param {Array} arr
 * @return {Array}
 */
export function unique(arr) {
	return arr.filter(_uniqueHandler);
}
const _uniqueHandler = (val, i, arr) => arr.indexOf(val) === i;

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
 * Returns a function, that, when invoked, will only be triggered at most once
 * during a given window of time.
 * @param  {Function} func
 * @param  {Number} wait
 */
export function throttle(func, wait) {
	var context, args, timeout, result;
	var previous = 0;
	var later = function() {
		previous = Date.now();
		timeout = null;
		result = func.apply(context, args);
	};
	return function() {
		var now = Date.now();
		var remaining = wait - (now - previous);
		context = this;
		args = arguments;
		if (remaining <= 0) {
			clearTimeout(timeout);
			previous = now;
			result = func.apply(context, args);
		} else if (!timeout) {
			timeout = setTimeout(later, remaining);
		}
		return result;
	};
}

/**
 * Serializes given object into JSON, including Map and Set objects
 * @param  {any} obj
 * @return {any}
 */
export function serialize(obj) {
	if (obj instanceof Set) {
		obj = Array.from(obj);
	}

	if (Array.isArray(obj)) {
		return obj.map(serialize);
	}

	if (obj instanceof Map) {
		return Array.from(obj.keys()).reduce((out, key) => {
			out[key] = serialize(obj.get(key));
			return out;
		}, {});
	}

	if (obj && typeof obj === 'object') {
		return Object.keys(obj).reduce((out, key) => {
			out[key] = serialize(obj[key]);
			return out;
		}, {});
	}

	return obj;
}

export function error(code, message) {
    var err = new Error(code || message);
    err.code = code;
    return err;
}

export function objToMap(obj) {
	if (obj instanceof Map) {
		return new Map(obj);
	}
	return Object.keys(obj || {}).reduce((out, key) => out.set(key, obj[key]), new Map());
}
