var STATE_PENDING   = 'pending';
var STATE_FULFILLED = 'fulfilled';
var STATE_REJECTED  = 'rejected';

import {toArray} from './utils';

function fulfill(listeners, args) {
	listeners.forEach(function(fn) {
		fn.apply(null, args);
	});
}

function isFn(obj) {
	return typeof obj === 'function';
}

export default function Deferred(fn) {
	if (!(this instanceof Deferred)) {
		return new Deferred(fn);
	}

	var state = STATE_PENDING;
	var value = void 0;
	var fulfilled = [];
	var rejected = [];
	var self = this;

	var respond = function(callbacks) {
		fulfill(callbacks, value);
		fulfilled.length = rejected.length = 0;
	};

	var changeState = function(newState, callbacks) {
		return function() {
			if (state === STATE_PENDING) {
				state = newState;
				value = toArray(arguments);
				respond(callbacks);
			}
			return self;
		};
	};

	this.resolve = changeState(STATE_FULFILLED, fulfilled);
	this.reject = changeState(STATE_REJECTED, rejected);
	this.then = function(onFulfilled, onRejected) {
		isFn(onFulfilled) && fulfilled.push(onFulfilled);
		isFn(onRejected) && rejected.push(onRejected);
		if (state === STATE_FULFILLED) {
			respond(fulfilled);
		} else if (state === STATE_REJECTED) {
			respond(rejected);
		}

		return this;
	};

	Object.defineProperty(this, 'state', {
		enumerable: true,
		get: function() {
			return state;
		}
	});

	if (isFn(fn)) {
		fn.call(this);
	}
}