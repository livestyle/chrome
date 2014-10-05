/**
 * Main popup controller
 */
define(function(require) {
	var selectBox = require('./js/select-box');
	var compactPaths = require('../lib/helpers/compact-paths');
	var utils = require('../lib/utils');

	function $(selector, context) {
		return (document || context).querySelector(selector);
	}

	function $$(selector, context) {
		var result = (document || context).querySelectorAll(selector);
		return Array.prototype.slice.call(result, 0);
	}

	function ancestorOrSelf(elem, className) {
		while (elem && elem !== document) {
			if (elem.classList && elem.classList.contains(className)) {
				return elem;
			}
			elem = elem.parentNode;
		}
	}

	function copy(obj) {
		return utils.extend({}, obj);
	}

	function sendMessage(name, data) {
		chrome.runtime.sendMessage({
			name: name,
			data: data
		});
	}

	function renderFileItem(label, value, editorFilesView, isUserFile) {
		var parts = label.split('?');
		label = parts.shift();
		if (isUserFile) {
			label += '<i class="file__remove"></i>';
		}
		if (parts.length) {
			label += '<span class="file__browser-addon">' + parts.join('?') + '</span>';
		}

		return '<li class="file-list__item' + (isUserFile ? ' file-list__item_user' : '') + '">'
			+ '<div class="file__browser" data-full-path="' + value + '">' + label + '</div>'
			+ '<div class="file__editor">'
			+ editorFilesView
			+ '</div>';
	}

	function renderFileList(model) {
		var browserFiles = compactPaths(model.get('browserFiles') || []);
		var editorFiles = compactPaths(model.get('editorFiles') || []);
		var userStylesheets = model.get('userStylesheets') || {};
		var assocs = model.associations();
		
		console.log('user ss', userStylesheets);
		var html = '<ul class="file-list">'
			+ browserFiles.map(function(file) {
				return renderFileItem(file.label, file.value, populateSelect(file.value, editorFiles, assocs[file.value]));
			}).join('')
			+ Object.keys(userStylesheets).map(function(userId, i) {
				console.log('render user', userId);
				return renderFileItem('user stylesheet ' + (i + 1), userId, populateSelect(userId, editorFiles, assocs[userId]), true);
			}).join('')
			+ '</ul>';

		return toDom(html);
	}

	function prepareView(model) {
		var toggler = $('#fld-enabled');
		toggler.checked = !!model.get('enabled');
		toggler.addEventListener('change', function() {
			model.set('enabled', toggler.checked);
		});

		$('.add-file').addEventListener('click', function(evt) {
			evt.stopPropagation();
			sendMessage('add-user-stylesheet');
		});

		document.addEventListener('click', function(evt) {
			if (evt.target.classList.contains('file__remove')) {
				evt.stopPropagation();
				var browserFile = ancestorOrSelf(evt.target, 'file__browser');
				sendMessage('remove-user-stylesheet', {url: browserFile.dataset.fullPath});
			}
		});
	}

	function renderView(model) {
		var fileList = renderFileList(model);
		var prevFileList = $('.file-list');
		var parent = prevFileList.parentNode;
		parent.insertBefore(fileList, prevFileList);
		parent.removeChild(prevFileList);
		selectBox(fileList);
		$$('select', fileList).forEach(function(select) {
			select.addEventListener('change', function() {
				var assocs = copy(model.get('assocs'));
				assocs[select.name] = select.value;
				model.set('assocs', assocs);
			}, false);
		});
	}

	function handleUpdate() {
		console.log('model updated', this.toJSON());
		renderView(this);
	}

	function populateSelect(name, options, selected) {
		return '<select name="' + name + '" id="fld-' + name + '">'
			+ '<option value="">…</option>'
			+ options.map(function(option, i) {
				var selectedAttr = (selected === i || selected === option.value) 
					? ' selected="selected"' 
					: '';
				return '<option value="' + option.value + '"' + selectedAttr + '>' + option.label + '</option>';
			}).join('')
			+ '</select>';
	}

	function toDom(html) {
		var div = document.createElement('div');
		div.innerHTML = html;
		var result = div.firstChild;
		div.removeChild(result);
		return result;
	}

	function checkErrorState(tracker) {
		var toggle = function() {
			var hasError = tracker.get('error');
			$('.error-message').classList.toggle('hidden', !hasError);
		};
		tracker.on('change:error', toggle);
		toggle();
	}

	/**
	 * Displays permanent link on error log
	 */
	function showErrorLogLink() {
		$('.error-log-link').classList.remove('hidden');
	}

	chrome.runtime.onMessage.addListener(function(message) {
		if (message.name === 'log-updated') {
			showErrorLogLink();
		}
	});

	// bind model with view
	chrome.runtime.getBackgroundPage(function(bg) {
		var LiveStyle = bg.LiveStyle;

		// keep track of errors
		checkErrorState(LiveStyle.errorStateTracker);

		if (LiveStyle.hasErrors()) {
			showErrorLogLink();
		}

		LiveStyle.getCurrentModel(function(model) {
			prepareView(model);
			model.on('update', handleUpdate);
			window.addEventListener('unload', function() {
				model.off('update', handleUpdate);
			}, false);
			renderView(model);
		});
	});
});