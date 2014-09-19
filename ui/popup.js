/**
 * Main popup controller
 */
define(['./js/select-box'], function(selectBox) {
	var selectBox = require('./js/select-box');
	var modelController = require('../lib/controllers/model');

	var selectBoxList = [];

	function renderContent(model, context) {
		
	}

	function populateSelect(name, options) {
		var html = '<select name="' + name + '" id="fld-' + name + '">'
			+ options.map(function(item) {
				return '<option value="' + item + '">' + item + '</option>';
			})
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
	 * @return {Array} List of objects with <code>name</code> and
	 * <code>path</code> properties
	 */
	function prettifyPaths(list) {
		var compact = function(item) {
			return !!item;
		};

		var lookup = list.map(function(path) {
			
		});
	}

	// bind model with view
	document.addEventListener('DOMContentLoaded', function() {
  		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  			var activeTab = tabs[0];

  		});
	});

	selectBox(document.body);
})