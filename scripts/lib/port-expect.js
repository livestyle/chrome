/**
 * A wrapper for Chrome Port messaging able to send given message and wait for
 * response with expected message name
 */
'use strict';

export default function(port, name, data, expectResponse) {
	if (typeof data === 'string' && expectResponse == null) {
		expectResponse = data;
		data = null;
	}

	return new Promise(function(resolve, reject) {
		var isResponded = false;
		var handleResponse = function(message) {
			if (message && message.name === expectResponse) {
				resolve(message.data);
				port.onMessage.removeListener(handleResponse);
			}
		};

		// in case of any error in DevTools page, respond after some time
		setTimeout(() => {
			var err = new Error(`Expectation timeout: did not received "${expectResponse}" response`);
		}, 3000);

		port.onMessage.addListener(handleResponse);
		port.postMessage({name, data});
	});
};