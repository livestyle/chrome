define(function(require) {
	var backgroundPageConnection = chrome.runtime.connect({
		name: 'devtools-page:' + chrome.devtools.inspectedWindow.tabId
	});
});