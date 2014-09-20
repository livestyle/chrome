/**
 * Returns URLs of all stylesheets avaliable on given page
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var injectJS = '(function() {' + findStyleSheets.toString() + ';return findStyleSheets(document.styleSheets);})();';
	
	function getTab(request, callback) {
		if (typeof request === 'object' && 'windowId' in request) {
			// passed object is a Tab
			return callback(request);
		}

		chrome.tabs.query({url: request}, function(tabs) {
			callback(tabs && tabs[0]);
		});
	}

	/**
	 * Findes all stylesheets in given context, including
	 * nested `@import`s
	 * @param  {StyleSheetList} ctx List of stylesheets to scan
	 * @return {Array} Array of stylesheet URLs
	 */
	function findStyleSheets(ctx, out) {
		out = out || [];
		for (var i = 0, il = ctx.length, url, item; i < il; i++) {
			item = ctx[i];
			url = item.href;
			if (~out.indexOf(url)) {
				// stylesheet already added
				continue;
			}

			if (url) {
				out.push(url);
			}
			
			// find @import rules
			if (item.cssRules) {
				for (var j = 0, jl = item.cssRules.length; j < jl; j++) {
					if (item.cssRules[j].type == 3) {
						findStyleSheets([item.cssRules[j].styleSheet], out);
					}
				}
			}
		}
		
		return out;
	}

	function getStylesheetsFromTab(tab, callback) {
		chrome.tabs.executeScript(tab.id, {code: injectJS}, function(result) {
			callback(result && result[0]);
		});
	}

	/**
	 * Returns URLs of all stylesheets avaliable on given page
	 * @param  {Tab|String} request Tab object or tab URL
	 * @param  {Function} callback
	 */
	return function(request, callback) {
		getTab(request, function(tab) {
			tab ? getStylesheetsFromTab(tab, callback) : callback();
		});
	};
});