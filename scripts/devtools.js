import * as resources  from './devtools/resources';

var port = chrome.runtime.connect({
	name: 'devtools-page:' + chrome.devtools.inspectedWindow.tabId
});

function send(name, data) {
	port.postMessage({
		name: name,
		data: data
	});
}

function log() {
	send('log', Array.prototype.slice.call(arguments, 0));
}

port.onMessage.addListener(function(message) {
	log('Received message', message);
	switch (message.name) {
		case 'diff':
			resources.get(message.data.uri, function(res) {
				res && res.patch(message.data.patches);
			});
			break;
		case 'pending-patches':
			resources.applyPendingPatches(message.data);
			break;
		case 'get-stylesheets':
			resources.list(function(urls) {
				send('stylesheets', urls);
			});
			break;
		case 'reset':
			resources.reset();
			break;
	}
});

resources.on('log', function(strings) {
	log.apply(null, strings);
});
log('Connected');