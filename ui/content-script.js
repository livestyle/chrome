(function() {
	function $$(sel, context) {
		var items = (context || document).querySelectorAll(sel);
		return Array.prototype.slice.call(items, 0);
	}

	function applyPatches(url, patches) {
		var stylesheets = livestyleCSSOM.stylesheets();
		if (stylesheets[url]) {
			livestyleCSSOM.patch(stylesheets[url], patches);
		}
	}

	function userStylesheets() {
		$$('link[rel="stylesheet"]').filter(function(link) {
			return !!link.dataset.livestyleId;
		});
	}

	/**
	 * Creates `amount` new stylesheets on current page
	 * @param  {Number} amount How many stylesheets should be created
	 * @returns {Array} Array of stylesheet URLs
	 */
	function createUserStylesheet(url) {
		if (!Array.isArray(url)) {
			url = [url];
		}

		var result = {};
		url.forEach(function(internalUrl) {
			var blob = new Blob([''], {type: 'text/css'});
			var url = window.URL.createObjectURL(blob);
			var link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = url;
			link.dataset.livestyleId = internalUrl;
			document.head.appendChild(link);
			result[internalUrl] = url;
		});

		return result;
	}

	/**
	 * Removes stylesheet with given URL (blob or internal LiveStyle ID)
	 * @param  {String} url
	 */
	function removeUserStylesheet(url) {
		console.log('Removing stylesheet', url);
		userStylesheets().forEach(function(link) {
			if (link.href === url || link.dataset.livestyleId == url) {
				removeLink(link);
			}
		});
	}

	function removeLink(link) {
		link.parentNode.removeChild(link);
		window.URL.revokeObjectURL(link.href);
	}

	/**
	 * Validates given user stylesheets: adds missing and removes redundant ones
	 * @param  {String} url Internal URL or array of URLs
	 * @return {Object}     Hash where key is given URL and value if stylesheets’ 
	 * blob URL
	 */
	function validateUserStylesheets(url, callback) {
		var result = {};
		var cur = userStylesheets();
		if (!Array.isArray(url)) {
			url = [url];
		}
		
		// remove redundant
		var exists = {};
		cur.forEach(function(item) {
			if (~url.indexOf(item.dataset.livestyleId)) {
				removeLink(item);
			} else {
				exists[item.dataset.livestyleId] = item.href;
			}
		});

		// create missing
		createUserStylesheet(url.filter(function(item) {
			return !(item in exists);
		}), function(blobs) {
			// re-create result hash with keys in right order
			var result = {};
			url.forEach(function(item) {
				result[item] = exists[item] || blobs[item];
			});
		});
	}

	chrome.runtime.onMessage.addListener(function(message) {
		if (!message) {
			return;
		}

		var data = message.data;
		switch (message.name) {
			case 'apply-cssom-patch':
				return applyPatches(data.stylesheetUrl, data.patches);
			case 'remove-user-stylesheet':
				return removeUserStylesheet(data.url);
		}
	});

	// Use separate listener for events that require explicit response
	chrome.runtime.onMessage.addListener(function(message, callback) {
		if (!message) {
			return;
		}

		switch (message.name) {
			case 'create-user-stylesheet':
				return callback(createUserStylesheet(message.data.url));
			case 'validate-user-stylesheet':
				return callback(validateUserStylesheets(message.data.url));
		}
	});
})();