define(function(require, module, exports) {
	var boxes = [];

	function el(name, className) {
		var elem = document.createElement('div');
		if (className) {
			elem.className = className;
		}
		return elem;
	}

	function ancestorOrSelf(elem, className) {
		while (elem && elem !== document) {
			if (elem.classList && elem.classList.contains(className)) {
				return elem;
			}
			elem = elem.parentNode;
		}
	}

	/**
	 * Creates custom select box from given <select>
	 * element
	 * @param {Element} sel
	 */
	function SelectBox(sel) {
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

	SelectBox.prototype = {
		_attachEvents: function() {
			var self = this;
			this._sel.addEventListener('change', this.sync.bind(this));
			this._sel.addEventListener('sync', this.sync.bind(this));
			this.label.addEventListener('click', this.toggle.bind(this));
			this.picker.addEventListener('click', function(evt) {
				var pickerItem = ancestorOrSelf(evt.target, 'select-box__picker-item');
				if (pickerItem) {
					self._sel.selectedIndex = +pickerItem.getAttribute('data-ix');
					self.hide();
					
					var event = self._sel.ownerDocument.createEvent('Events');
					event.initEvent('change', true, true);
					self._sel.dispatchEvent(event);
				}
			});
		},

		toggle: function() {
			this.box.classList.toggle('select-box_active');
		},

		hide: function() {
			this.box.classList.remove('select-box_active');
		},

		show: function() {
			this.box.classList.add('select-box_active');
		},

		/**
		 * Syncronises select box content with
		 * original <select> element
		 */
		sync: function() {
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
		},

		destroy: function() {
			var ix = boxes.indexOf(this);
			if (~ix) {
				boxes.splice(ix, 1);
			}
			this._sel = this.box = this.label = this.picker = null;
		}
	};

	document.addEventListener('click', function(evt) {
		// if clicked inside select box – do nothing
		if (!ancestorOrSelf(evt.target, 'select-box')) {
			boxes.forEach(function(box) {
				box.hide();
			});
		}
	});


	exports = function(container) {
		var items = document.getElementsByTagName('select'), sel;
		for (var i = 0, il = items.length; i < il; i++) {
			exports.convert(items[i]);
		}
	};

	exports.find = function(sel) {
		var matchedBox = null;
		boxes.some(function(box) {
			if (box._sel === sel) {
				return matchedBox = box;
			}
		});

		return matchedBox;
	};

	exports.convert = function(sel) {
		if (!sel.getAttribute('data-select-box')) {
			return new SelectBox(sel);
		}

		return exports.find(sel);
	};

	exports.sync = function(sel) {
		var box = exports.find(sel);
		if (box) {
			return box.sync();
		}
	};

	return exports;
});