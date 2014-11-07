/**
 * A DevTools controller for background page.
 *
 * For generic CSS patching extension uses CSSOM
 * which is very fast even on large sources. The problem is
 * that these changes in CSSOM are not reflected original
 * source, e.g. in DevTools you’ll still see unchanges properties.
 * Moreover, any change in DevTools will reset all CSSOM changes.
 *
 * This module keeps track of all pending diffs for tabs and
 * when DevTools for tab became available, it flushes these 
 * changes to DevTools page so it can apply diffs on page resources.
 */
define(function(require) {
	var openedDevtools = {};
	var pendingPatches = {};

	var devtoolsPort = /^devtools\-page:(\d+)$/;

	function normalizeUrl(url) {
		return url.split('#')[0];
	}

	/**
	 * Show log messages coming from DevTools
	 * @param  {Array} strings Array of string
	 */
	function devtoolsLog(strings) {
		var args = ['%c[DevTools]', 'background-color:#344a5d;color:#fff'].concat(strings);
		console.log.apply(console, args);
	}

	/**
	 * Handles incoming messages from DevTools connection port
	 * @param  {Object} message Incoming message
	 */
	function devtoolsMessageHandler(message) {
		if (message.name === 'log') {
			devtoolsLog(message.data);
		}
	}

	function resetPatches(tabId) {
		if (tabId in pendingPatches) {
			delete pendingPatches[tabId];
		}
	}

	chrome.runtime.onConnect.addListener(function(port) {
		var m = port.name.match(devtoolsPort);
		if (m) {
			var tabId = +m[1];
			openedDevtools[tabId] = port;
			console.log('Opened devtools for', tabId);

			if (tabId in pendingPatches) {
				// flush pending patches
				port.postMessage({
					name: 'pending-patches',
					data: pendingPatches[tabId]
				});
				delete pendingPatches[tabId];
			}

			port.onMessage.addListener(devtoolsMessageHandler);

			port.onDisconnect.addListener(function() {
				console.log('Closed devtools for', tabId);
				delete openedDevtools[tabId];
				port.onMessage.removeListener(devtoolsMessageHandler);
			});
		}
	});

	// cleanup patches when tab is closed or refreshed
	chrome.tabs.onRemoved.addListener(resetPatches);
	chrome.tabs.onUpdated.addListener(resetPatches);

	return {
		saveDiff: function(tabId, stylesheetUrl, patches) {
			if (openedDevtools[tabId]) {
				// we have opened DevTools for this tab,
				// send diff directly to it
				console.log('DevTools opened, send diff directly');
				return openedDevtools[tabId].postMessage({
					name: 'diff',
					data: {
						uri: stylesheetUrl,
						syntax: 'css', // always CSS
						patches: patches
					}
				});
			}

			// no opened DevTools, accumulate changes
			if (!pendingPatches[tabId]) {
				pendingPatches[tabId] = {};
			}

			if (!pendingPatches[tabId][stylesheetUrl]) {
				pendingPatches[tabId][stylesheetUrl] = [];
			}

			console.log('Append patches for', stylesheetUrl);
			pendingPatches[tabId][stylesheetUrl] = pendingPatches[tabId][stylesheetUrl].concat(patches);
		}
	};
});