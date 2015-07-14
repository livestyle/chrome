/**
 * Remote View UI
 */
import {$, $$} from '../lib/utils';
import tween from '../lib/tween';

var animating = false;

export default function(container) {
	container.addEventListener('click', function(evt) {
		if (evt.target.classList.contains('rv-learn-more') || isExpanded(container)) {
			toggleExpand(container);
		}
	});
}

function isExpanded(section) {
	return section.classList.contains('rv__expanded');
}

function toggleExpand(section, callback) {
	if (isExpanded(section)) {
		collapse(section, callback);
	} else {
		expand(section, callback);
	}
}

function expand(section, callback) {
	if (animating) {
		return;
	}

	var content = $('.rv-description', section);
	var rect = section.getBoundingClientRect();
	var offset = rect.top | 0;

	section.classList.add('rv__expanded');
	animating = true;

	tween({
		duration: 300,
		easing: 'outCubic',
		step(pos) {
			section.style.transform = `translateY(${-offset * pos}px)`;
			content.style.height = (offset * pos) + 'px';
		},
		complete() {
			animating = false;
			callback && callback();
		}
	});
}

function collapse(section, callback) {
	if (animating) {
		return;
	}

	var content = $('.rv-description', section);
	var offset = content.offsetHeight | 0;

	section.classList.remove('rv__expanded');
	animating = true;

	tween({
		duration: 300,
		reverse: true,
		easing: 'outCubic',
		step(pos) {
			section.style.transform = `translateY(${-offset * pos}px)`;
			content.style.height = (offset * pos) + 'px';
		},
		complete() {
			animating = false;
			section.style.transform = content.style.height = '';
			callback && callback();
		}
	});
}