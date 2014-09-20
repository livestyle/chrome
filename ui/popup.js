/**
 * Main popup controller
 */
define(['./js/select-box'], function(selectBox) {
	var selectBox = require('./js/select-box');
	var selectBoxList = [];

	function $(selector, context) {
		return (document || context).querySelector(selector);
	}

	function $$(selector, context) {
		var result = (document || context).querySelectorAll(selector);
		return Array.prototype.slice.call(result, 0);
	}

	function renderFileList(model) {
		var browserFiles = prettifyPaths(model.get('browserFiles') || []);
		var editorFiles = prettifyPaths(model.get('editorFiles') || []);
		var assocs = model.associations();
		
		var html = '<ul class="file-list">'
			+ browserFiles.map(function(file) {
				var parts = file.label.split('?');
				var label = parts.shift();
				if (parts.length) {
					label += '<span class="file__browser-addon">' + parts.join('?') + '</span>';
				}

				return '<li class="file-list__item">'
					+ '<div class="file__browser">' + label + '</div>'
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

	/**
	 * Returns given paths with prettified and shortened names
	 * @param  {Array} list List of paths
	 * @return {Array} List of objects with <code>label</code> and
	 * <code>value</code> properties
	 */
	function prettifyPaths(list) {
		return list.map(function(file) {
			return {
				label: file,
				value: file
			};
		});

		// var compact = function(item) {
		// 	return !!item;
		// };

		// var lookup = list.map(function(path) {
			
		// });
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