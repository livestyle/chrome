/**
 * Main popup controller
 */
define(function(require) {
	var selectBox = require('./js/select-box');
	var compactPaths = require('../lib/helpers/compact-paths');

	function $(selector, context) {
		return (document || context).querySelector(selector);
	}

	function $$(selector, context) {
		var result = (document || context).querySelectorAll(selector);
		return Array.prototype.slice.call(result, 0);
	}

	function renderFileList(model) {
		var browserFiles = compactPaths(model.get('browserFiles') || []);
		var editorFiles = compactPaths(model.get('editorFiles') || []);
		var assocs = model.associations();
		
		var html = '<ul class="file-list">'
			+ browserFiles.map(function(file) {
				var parts = file.label.split('?');
				var label = parts.shift();
				if (parts.length) {
					label += '<span class="file__browser-addon">' + parts.join('?') + '</span>';
				}

				return '<li class="file-list__item">'
					+ '<div class="file__browser" data-full-path="' + file.value + '">' + label + '</div>'
					+ '<div class="file__editor">'
					+ populateSelect(file.value, editorFiles, assocs[file.value])
					+ '</div>';
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
				var assocs = model.get('assocs') || {};
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

	// bind model with view
	chrome.runtime.getBackgroundPage(function(bg) {
		bg.LiveStyle.getCurrentModel(function(model) {
			prepareView(model);
			model.on('update', handleUpdate);
			window.addEventListener('unload', function() {
				model.off('update', handleUpdate);
			}, false);
			renderView(model);
		});
	});
});