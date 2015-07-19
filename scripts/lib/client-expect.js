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
		expect(expectedMessageName, validate, timeout=1000) {
			if (messageSent) {
				var err = new Error(`Message "${expectedMessageName}" already sent`);
				err.code = 'EMESSAGESENT';
				return Promise.reject(err);
			}

			if (typeof validate === 'number') {
				timeout = validate;
				validate = null;
			}

			return new Promise(function(resolve, reject) {
				var cancelId = setTimeout(function() {
					client.off('message-receive', callback);
					var err = new Error(`Expected message "${expectedMessageName}" timed out`);
					err.code = 'EEXPECTTIMEOUT';
					err.messageName = expectedMessageName;
					reject(err);
				}, timeout);

				var callback = function(name, data) {
					if (name === expectedMessageName) {
						var isValid = true;
						if (validate) {
							try {
								isValid = validate(data);
							} catch (e) {
								isValid = false;
							}
						}

						if (isValid) {
							client.off('message-receive', callback);
							clearTimeout(cancelId);
							resolve(data);
						}
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