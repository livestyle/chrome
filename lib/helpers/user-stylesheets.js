/**
 * Manages user stylesheets life cycle.
 * A user stylesheet is a stylesheet created by LiveStyle
 * on current page specifically for live updates:
 * it is addeb below page stylesheets (hence has higher
 * priority), it’s small and fast: a good alternative 
 * for very large page stylesheets where each update
 * could take some time
 */
define(function() {
	var reUser = /^livestyle:([0-9]+)$/;
	return {
		/**
		 * Creates user stylsheets for given IDs and
		 * returns hash where key is given ID and value
		 * is generated Blob URL
		 * @param  {Array}   urls      Array of interlat LiveStyle IDs
		 * @param  {Function} callback Invoked with hash result
		 */
		create: function(tabId, url, callback) {
			if (!url || !url.length) {
				return callback({});
			}

			chrome.tabs.sendMessage(tabId, {
				name: 'create-user-stylesheet',
				data: {url: url}
			}, callback);
		},
		/**
		 * Removes stylesheet with given URL (blob or internal LiveStyle ID)
		 * @param  {String} url Stylesteet URL
		 */
		remove: function(tabId, url) {
			chrome.tabs.sendMessage(tabId, {
				name: 'remove-user-stylesheet',
				data: {url: url}
			});
		},

		/**
		 * Validates given list of interla URLs: creates missing
		 * and removes redundant stylesheets
		 * @param  {String}   url      Internal URL or array of URLs
		 * @param  {Function} callback Callback function receives hash
		 * where key is given URL and value is generated blob URL
		 */
		validate: function(tabId, url, callback) {
			if (!url || !url.length) {
				return	callback({});
			}

			chrome.tabs.sendMessage(tabId, {
				name: 'validate-user-stylesheet',
				data: {url: url}
			}, callback);
		},

		/**
		 * Check if given URL is user stylesheet file
		 * @param {String} url
		 * @return {Boolean} 
		 */
		is: function(url) {
			var m = url.match(reUser);
			return m && m[1];
		}
	};
});