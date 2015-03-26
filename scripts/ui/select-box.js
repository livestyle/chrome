import {$$, closest} from '../lib/utils';
var boxes = [];

export default function(container) {
	$$('script').forEach(convert);
}

export function find(sel) {
	var matchedBox = null;
	boxes.some(function(box) {
		if (box._sel === sel) {
			return matchedBox = box;
		}
	});

	return matchedBox;
};

export function convert(sel) {
	if (!sel.getAttribute('data-select-box')) {
		return new SelectBox(sel);
	}

	return find(sel);
};

export function sync(sel) {
	var box = find(sel);
	if (box) {
		return box.sync();
	}
}

/**
 * Creates custom select box from given <select>
 * element
 * @param {Element} sel
 */
export class SelectBox {
	constructor(sel) {
		this._sel = sel;
		this.box = el('div', 'select-box');
		this.label = el('span', 'select-box__label');
		this.picker = el('ul', 'select-box__picker');

		this._attachEvents();
		this.sync();
		this._sel.classList.add('offscreen');
		this._sel.setAttribute('data-select-box', 'true');

		this.box.appendChild(this.label);
		this.box.appendChild(this.picker);
		this._sel.parentNode.insertBefore(this.box, this._sel);

		boxes.push(this);
	}

	_attachEvents() {
		var self = this;
		this._sel.addEventListener('change', this.sync.bind(this));
		this._sel.addEventListener('sync', this.sync.bind(this));
		this.label.addEventListener('click', this.toggle.bind(this));
		this.picker.addEventListener('click', function(evt) {
			var pickerItem = closest(evt.target, '.select-box__picker-item');
			if (pickerItem) {
				self._sel.selectedIndex = +pickerItem.getAttribute('data-ix');
				self.hide();
				
				var event = self._sel.ownerDocument.createEvent('Events');
				event.initEvent('change', true, true);
				self._sel.dispatchEvent(event);
			}
		});
	}

	toggle() {
		if (this.box.classList.contains('select-box_active')) {
			this.hide();
		} else {
			this.show();
		}
	}

	hide() {
		this.box.classList.remove('select-box_active');
	}

	show() {
		this.picker.classList.remove('select-box__picker_attop');
		this.picker.style.height = '';
		this.box.classList.add('select-box_active');
		
		// detect picker position and adjust it if required
		var pickerRect = this.picker.getBoundingClientRect();
		var viewportHeight = window.innerHeight;
		if (pickerRect.bottom <= viewportHeight) {
			// select box is completely visible
			return;
		}

		// let’s if it’s visible at top
		this.picker.classList.add('select-box__picker_attop');
		var pickerTopRect = this.picker.getBoundingClientRect();
		if (pickerTopRect.top >= 0) {
			return;
		}

		// picker is not completely visible neither at top nor bottom,
		// pick the best location, e.g. the one with more space
		var topDelta = Math.abs(pickerTopRect.top);
		var bottomDelta = Math.abs(pickerRect.bottom - viewportHeight);
		var height = pickerTopRect.height;
		if (bottomDelta < topDelta) {
			// keep at bottom
			this.picker.classList.remove('select-box__picker_attop');
			height = pickerRect.height;
		}

		this.picker.style.height = (height - Math.min(topDelta, bottomDelta)) + 'px';
	}

	/**
	 * Syncronises select box content with
	 * original <select> element
	 */
	sync() {
		var options = this._sel.options;
		var selIx = this._sel.selectedIndex;
		this.label.innerText = options[selIx] ? options[selIx].label : '...';

		// remove old picker items
		while (this.picker.firstChild) {
			this.picker.removeChild(this.picker.firstChild);
		}

		for (var i = 0, il = options.length, item; i < il; i++) {
			item = el('li', 'select-box__picker-item');
			item.innerText = options[i].label;
			item.setAttribute('data-ix', i);
			if (i === selIx) {
				item.classList.add('select-box__picker-item_selected');
			}
			this.picker.appendChild(item);
		}
	}

	destroy() {
		var ix = boxes.indexOf(this);
		if (~ix) {
			boxes.splice(ix, 1);
		}
		this._sel = this.box = this.label = this.picker = null;
	}
}

function el(name, className) {
	var elem = document.createElement('div');
	if (className) {
		elem.className = className;
	}
	return elem;
}

document.addEventListener('click', function(evt) {
	// if clicked inside select box – do nothing
	if (!closest(evt.target, '.select-box')) {
		boxes.forEach(function(box) {
			box.hide();
		});
	}
});