/**
 * Displays browser action icon according to current activity state
 */
'use strict';

import deferred from './deferred';

var states = {};
var loaded = deferred();
var canvas = document.createElement('canvas');
var ctx = canvas.getContext('2d');
var images = {
	disabled: image('./icon/ba-disabled.png'),
	active:   image('./icon/ba-active.png'),
	error1:   image('./icon/ba-error1.png'),
	error2:   image('./icon/ba-error2.png')
};
var PI2 = Math.PI * 2;
var errState = {
	pos: 0,
	step: 0.05
};

canvas.width = canvas.height = 19;

export function state(tabId, value) {
	if (typeof value !== 'undefined' && value !== states[tabId]) {
		states[tabId] = value;
		loaded.then(function() {
			renderState(tabId, value);
		});
	}
	return states[tabId];
}

export function reset() {
	Object.keys(states).forEach(function(tabId) {
		renderState(tabId, 'disabled');
		clearState(tabId)
	});
}

export function clearState(tabId) {
	delete states[tabId];
}

function image(src) {
	var img = new Image();
	img.onload = function() {
		if (!loaded.total) {
			loaded.total = 0;
		}

		img.onload = null;
		if (++loaded.total >= Object.keys(images).length) {
			loaded.resolve(images);
		}
	};
	img.src = src;
	return img;
}

function clear() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	return ctx;
}

function draw(image) {
	ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

function renderState(tabId, state) {
	if (states[tabId] === 'error') {
		renderErrorState();
	} else if (images[state]) {
		clear();
		draw(images[state]);
		paintIcon(tabId);
	} else {
		console.warn('Unknown icon state:', state);
	}
}

function renderErrorState() {
	var tabs = Object.keys(states);
	var errTabs = tabs.filter(function(tabId) {
		return states[tabId] === 'error';
	});

	if (!errTabs.length) {
		return tabs.forEach(function(tabId) {
			renderState(tabId, states[tabId]);
		});
	}

	errState.pos = (errState.pos + errState.step) % PI2;
	var alpha = Math.cos(errState.pos) * 0.5 + 0.5;

	clear();
	ctx.save();
	ctx.globalAlpha = alpha;
	draw(images.error1);
	ctx.globalAlpha = 1 - alpha;
	draw(images.error2);
	ctx.restore();

	errTabs.forEach(paintIcon);
	setTimeout(renderErrorState, 16);
}

function paintIcon(tabId) {
	chrome.browserAction.setIcon({
		imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
		tabId: +tabId
	});
}