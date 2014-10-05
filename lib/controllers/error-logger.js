/**
 * Logs all errors in LiveStyle worker. Unlike error tracker, which
 * simply notifies user about possible errors, this method actually
 * logs error messages and displays them upon request
 */
define(function() {
	var logItems = [];
	var maxLogItems = 50;
	var messageId = 0;

	function logMessage(message, type) {
		// Remove items with the same message
		for (var i = logItems.length - 1; i >= 0; i--) {
			if (logItems[i].message == message) {
				logItems.splice(i, 1);
			}
		}

		logItems.push({
			messageId: messageId++,
			date: Date.now(),
			message: message,
			type: type
		});

		messageId %= 10000;

		while (logItems.length > maxLogItems) {
			logItems.shift();
		}

		chrome.runtime.sendMessage({
			name: 'log-updated',
			data: logItems
		});
	}

	function handleWorkerEvent(message) {
		var payload = message.data;
		if (payload.status === 'error') {
			logMessage(payload.data, 'error');
		}
	}

	// handle internal extension communication
	chrome.runtime.onMessage.addListener(function(message, sender, callback) {
		if (message.name === 'get-log') {
			callback(logItems);
			return true;
		}
	});

	return {
		/**
		 * Watches for errors on given LiveStyle patcher instance
		 * @param  {CommandQueue} patcher LiveStyle patcher
		 */
		watch: function(patcher) {
			patcher.worker.addEventListener('message', handleWorkerEvent);
		},

		/**
		 * Stops watching for errors on given LiveStyle patcher instance
		 * @param  {CommandQueue} patcher LiveStyle patcher
		 */
		unwatch: function(patcher) {
			patcher.worker.removeEventListener('message', handleWorkerEvent);
		},

		/**
		 * Returns currently logged items
		 * @return {Array} Array of log items
		 */
		getLog: function() {
			return logItems
		}
	};
});