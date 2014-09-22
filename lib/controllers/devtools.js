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

			port.onDisconnect.addListener(function() {
				console.log('Closed devtools for', tabId);
				delete openedDevtools[tabId];
			});
		}
	});

	// cleanup patches when tab is closed
	chrome.tabs.onRemoved.addListener(function(tabId) {
		if (tabId in pendingPatches) {
			delete pendingPatches[tabId];
		}
	});

	return {
		saveDiff: function(pageUrl, stylesheetUrl, patches) {
			// find all tabs that matches given URL
			// NB: we can’t use `url` request parameter to filter
			// specific tabs because URLs may contain fragmet identifiers
			chrome.tabs.query({windowType: 'normal'}, function(tabs) {
				tabs.filter(function(tab) {
					return normalizeUrl(tab.url) === pageUrl;
				}).forEach(function(tab) {
					if (openedDevtools[tab.id]) {
						// we have opened DevTools for this tab,
						// send diff directly to it
						return openedDevtools[tab.id].postMessage({
							name: 'diff',
							data: {
								uri: stylesheetUrl,
								syntax: 'css', // always CSS
								patches: patches
							}
						});
					}

					// no opened DevTools, accumulate changes
					if (!pendingPatches[tab.id]) {
						pendingPatches[tab.id] = {};
					}

					if (!pendingPatches[tab.id][stylesheetUrl]) {
						pendingPatches[tab.id][stylesheetUrl] = [];
					}

					pendingPatches[tab.id][stylesheetUrl] = pendingPatches[tab.id][stylesheetUrl].concat(patches);
				});
			})
		}
	};
});