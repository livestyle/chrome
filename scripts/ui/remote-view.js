/**
 * Remote View UI
 */
import {$, $$, toDom} from '../lib/utils';
import tween from '../lib/tween';


var messages = {
	unavailable: message(
		'Remote View is not available', 
		'Remote View only works for web-sites with HTTP or HTTPS protocols. <span class="rv-learn-more">Learn more</span>'
	),
	connecting: message('Connecting'),
	noApp: message('No LiveStyle App', 'Make sure <a href="http://livestyle.io/app/">LiveStyle app</a> is running.')
};

export default function(model, container) {
	// “Learn more” toggler
	container.addEventListener('click', function(evt) {
		if (evt.target.classList.contains('rv-learn-more') || isExpanded(container)) {
			toggleExpand(container);
		}
	});

	var url = parseUrl(model.get('url'));
	if (!/^https?:$/.test(url.protocol)) {
		container.classList.add('rv__unavailable');
		notify(container, messages.unavailable);
		return;
	}

	var enabled = false;
	var toggler = getToggler();
	var rvPayload = {localSite: url.origin};

	// check if there’s active RV session for current web-site
	toggler.disabled = true;
	sendMessage('rv-get-session', rvPayload, function(resp) {
		toggler.disabled = false;
		if (!resp || resp.error) {
			return;
		}

		enabled = toggler.checked = true;
		notify(container, sessionMessage(resp));
	});

	var _lastChange = 0; // prevents from accidental multiple clicks on toggler
	toggler.addEventListener('change', function() {
		if (Date.now() - _lastChange < 500 || this.checked === enabled) {
			return;
		}

		_lastChange = Date.now();
		enabled = this.checked;
		if (enabled) {
			console.log('creating session for', rvPayload);
			// create new RV session.
			// disable toggler until we get response from back-end, this will 
			// prevent from accidental toggles
			toggler.disabled = true;
			notify(container, messages.connecting);
			sendMessage('rv-create-session', rvPayload, function(resp) {
				toggler.disabled = false;
				console.log('creating session response', resp);
				if (resp.error) {
					enabled = toggler.checked = false;
					notify(container, errorMessage(resp));
				} else {
					notify(container, sessionMessage(resp));
				}
			});
		} else {
			// close existing session
			console.log('close session for', rvPayload);
			sendMessage('rv-close-session', rvPayload);
		}
	});
}

export function isEnabled(container) {
	return getState(container);
}

export function isExpanded(section) {
	return section.classList.contains('rv__expanded');
}

export function toggleExpand(section, callback) {
	if (isExpanded(section)) {
		collapse(section, callback);
	} else {
		expand(section, callback);
	}
}

export function notify(container, message) {
	if (typeof message === 'string') {
		message = {
			title: message,
			comment: ''
		};
	}

	if (message.title) {
		notifySection($('.rv-title', container), message.title);
	}

	if (message.comment) {
		notifySection($('.rv-comment', container), message.comment);
	}
}

function notifySection(container, message, callback) {
	if (container._animating) {
		// there’s message change animation running,
		// queue current message
		if (!container._msgQueue) {
			container._msgQueue = [];
		}

		return container._msgQueue.push([message, callback]);
	}

	if (message === null && container._msgDefault) {
		message = container._msgDefault;
	} else if (typeof message === 'string') {
		message = toDom(`<div class="rv-message">${message}</div>`);
	}

	// measure sizes and positions for previous message
	var pm = $('.rv-message', container);
	var pcRect = container.getBoundingClientRect();
	var pmRect = pm.getBoundingClientRect();

	// keep reference for default message
	if (!container._msgDefault) {
		container._msgDefault = pm;
	}

	// fix message state
	pm.style.width = pmRect.width + 'px';
	pm.style.left = (pmRect.left - pcRect.left) + 'px';
	pm.style.top = (pmRect.top - pcRect.top) + 'px';
	pm.style.position = 'absolute';

	// add new message and get new container state
	message.style.transform = `translateY(${pcRect.top}px)`;
	pm.parentNode.insertBefore(message, pm);
	var ncRect = container.getBoundingClientRect();

	// get ready for animation
	var dh = ncRect.height - pcRect.height;
	container.style.height = pcRect.height + 'px';
	container._animating = true;

	return tween({
		easing: 'outExpo',
		duration: 300,
		step(pos) {
			pm.style.transform = `translateY(${-pos * pcRect.height}px)`;
			message.style.transform = `translateY(${(1 - pos) * pcRect.height}px)`;
			if (dh) {
				container.style.height = (pcRect.height + pos * dh) + 'px';
			}
		},
		complete() {
			container._animating = false;
			pm.parentNode.removeChild(pm);

			// reset previous message state in case if it’s used
			// somewhere else
			pm.style.width = '';
			pm.style.left = '';
			pm.style.top = '';
			pm.style.position = '';

			message.style.transform = '';
			container.style.height = '';
			callback && callback();

			// do we have queued messages?
			if (container._msgQueue && container._msgQueue.length) {
				var queuedItem = container._msgQueue.shift();
				notifySection(container, queuedItem[0], queuedItem[1]);
			}
		}
	});
}

function parseUrl(url) {
	var a = document.createElement('a');
	a.href = url;
	return a;
}

function message(title, comment='') {
	return {title, comment};
}

function sessionMessage(session) {
	var publicUrl = `http://${session.publicId}`;
	return {
		title: `<a href="${publicUrl}">${publicUrl}</a>`,
		comment: `Use this URL to view ${session.localSite} in any internet-connect browser, mobile device, virual machine or share it with your friend and colleagues.`
	};
}

function errorMessage(err) {
	if (err.errorCode === 'ERVNOCONNECTION') {
		return messages.noApp;
	}

	var comment = err.error;
	if (err.errorCode) {
		comment += ` (${err.errorCode})`;
	}
	return {title: 'Error', comment};
}

function sendMessage(name, data, callback) {
	if (typeof data === 'function') {
		callback = data;
		data = null;
	}

	data = data || {};
	chrome.runtime.sendMessage({name, data}, callback);
}

function expand(section, callback) {
	if (section._animating) {
		return;
	}

	var content = $('.rv-description', section);
	var rect = section.getBoundingClientRect();
	var offset = rect.top | 0;

	section.classList.add('rv__expanded');
	section._animating = true;

	tween({
		duration: 400,
		easing: 'outExpo',
		step(pos) {
			section.style.transform = `translateY(${-offset * pos}px)`;
			content.style.height = (offset * pos) + 'px';
		},
		complete() {
			section._animating = false;
			callback && callback();
		}
	});
}

function collapse(section, callback) {
	if (section._animating) {
		return;
	}

	var content = $('.rv-description', section);
	var offset = content.offsetHeight | 0;

	section.classList.remove('rv__expanded');
	section._animating = true;

	tween({
		duration: 400,
		reverse: true,
		easing: 'outExpo',
		step(pos) {
			section.style.transform = `translateY(${-offset * pos}px)`;
			content.style.height = (offset * pos) + 'px';
		},
		complete() {
			section._animating = false;
			section.style.transform = content.style.height = '';
			callback && callback();
		}
	});
}

function setState(container, value) {
	getToggler(container).checked = !!value;
}

function getState(container) {
	return getToggler(container).checked;
}

function getToggler(container) {
	return $('[name="rv-enabled"]');
}