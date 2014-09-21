function applyPatches(url, patches) {
	var stylesheets = livestyleCSSOM.stylesheets();
	if (stylesheets[url]) {
		livestyleCSSOM.patch(stylesheets[url], patches);
	}
}

chrome.runtime.onMessage.addListener(function(message) {
	if (message && message.name === 'apply-cssom-patch') {
		var data = message.data;
		applyPatches(data.stylesheetUrl, data.patches);
	}
});