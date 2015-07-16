/**
 * A wrapper around LiveStyle client able to send messages and wait for expected
 * response
 */
'use strict';

import client from 'livestyle-client';

export function send(name, data) {
	var messageSent = false;
	setTimeout(function() {
		client.send(name, data);
		messageSent = true;
	}, 0);

	return {
		expect(expectedMessageName, timeout=2000) {
			if (messageSent) {
				return Promise.reject(new Error(`Message "${name}" already sent`));
			}

			return new Promise(function(resolve, reject) {
				var cancelId = setTimeout(function() {
					client.off('message-receive', callback);
					var err = new Error('Expected message timed out');
					err.messageName = expectedMessageName;
					reject(err);
				}, timeout);

				var callback = function(name, data) {
					if (name === expectedMessageName) {
						client.off('message-receive', callback);
						clearTimeout(cancelId);
						resolve(data);
					}
				};

				client.on('message-receive', callback);
			});
		}
	};
}

export function on() {
	client.on.apply(client, arguments);
}

export function off() {
	client.off.apply(client, arguments);
}

export function emit() {
	client.emit.apply(client, arguments);
}