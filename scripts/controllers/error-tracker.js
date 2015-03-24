/**
 * Keeps track of errors occured LiveStyle activity. 
 * Provides model with `error` boolean attribute indicating
 * if there’s something that user should be aware of.
 *
 * This controller tries to detect intermediate error states:
 * for example, when user type something he may accedentally 
 * put stylesheet in error state but fix it later. In this case,
 * we shouldn’t trigger error state.
 */
define(function(require) {
	var Model = require('../model');
	var utils = require('../utils');

	// Worker commads that commands may generate errors we should track
	var trackCommands = ['calculate-diff', 'apply-patch', 'initial-content'];
	var commandState = {};
	var errorFiles = [];
	var model = new Model();
	model.set({
		error: false,
		warning: false
	});

	var setErrorState = utils.debounce(function() {
		if (errorFiles.length) {
			model.set('error', true);
			resetErrorState();
		}
	}, 2000);

	var resetErrorState = utils.debounce(function() {
		model.set('error', false);
		errorFiles.length = 0;
	}, 30000);
	

	function markError(uri) {
		if (!~errorFiles.indexOf(uri)) {
			errorFiles.push(uri);
			setErrorState();
		}
	}

	function unmarkError(uri) {
		var ix = errorFiles.indexOf(uri);
		if (~ix) {
			errorFiles.splice(ix, 1);
		}
	}

	function handleWorkerEvent(payload) {
		if (!payload.commandId) {
			return;
		}

		if ('name' in payload && ~trackCommands.indexOf(payload.name)) {
			// a command request sent to worker
			commandState[payload.commandId] = {
				created: Date.now(),
				uri: payload.data.uri
			};
		} else if ('status' in payload && payload.commandId in commandState) {
			// a reply from worker on previous command request
			var state = commandState[payload.commandId];
			if (payload.status === 'error') {
				markError(state.uri);
			} else {
				unmarkError(state.uri);
			}
			delete commandState[payload.commandId];
		}
	}

	// Watch for hung states: ones we didn’t received reply on
	setInterval(function() {
		var end = Date.now() + 10000;
		Object.keys(commandState).forEach(function(id) {
			if (commandState[id].created < end) {
				delete commandState[id];
			}
		});
	}, 5000);

	/**
	 * Listens to events on given LiveStyle worker command queue
	 * @param {CommandQueue} commandQueue
	 */
	model.watch = function(commandQueue) {
		commandQueue.on('command-create command-reply', handleWorkerEvent);
		return this;
	};

	/**
	 * Stops listening events on given LiveStyle worker
	 * @param {CommandQueue} commandQueue
	 */
	model.unwatch = function(commandQueue) {
		commandQueue.off('command-create command-reply', handleWorkerEvent);
		return this;
	};

	return model;
});