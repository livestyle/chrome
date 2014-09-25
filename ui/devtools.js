define(function(require) {
	var resources = require('../lib/devtools/resources');

	var port = chrome.runtime.connect({
		name: 'devtools-page:' + chrome.devtools.inspectedWindow.tabId
	});

	function log() {
		port.postMessage({
			name: 'log',
			data: Array.prototype.slice.call(arguments, 0)
		});
	}

	port.onMessage.addListener(function(message) {
		log('Received message', message);
		switch (message.name) {
			case 'diff':
				resources.get(message.data.uri, function(res) {
					log('Has resource for', message.data.uri, !!res);
					res && res.patch(message.data.patches);
				});
				break;
			case 'pending-patches':
				resources.applyPendingPatches(message.data);
				break;
		}
	});

	resources.on('log', function(strings) {
		log.apply(null, strings);
	});
	log('Connected');
});