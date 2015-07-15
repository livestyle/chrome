/**
 * Remote View UI
 */
import {$, $$, toDom} from '../lib/utils';
import tween from '../lib/tween';

export default function(container) {
	container.addEventListener('click', function(evt) {
		if (evt.target.classList.contains('rv-learn-more') || isExpanded(container)) {
			toggleExpand(container);
		}
	});
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

export function setMessage(container, message, callback) {
	if (container._animating) {
		// there’s message change animation running,
		// queue current message
		if (!container._msgQueue) {
			container._msgQueue = [];
		}

		return container._msgQueue.push([message, callback]);
	}

	if (!message && container._msgDefault) {
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
				setMessage(container, queuedItem[0], queuedItem[1]);
			}
		}
	});
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