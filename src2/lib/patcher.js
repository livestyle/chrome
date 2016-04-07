/**
 * LiveStyle patcher connector.
 * Patcher works as a Web Worker, this module creates worker and establishes
 * connection via command queue
 */
'use strict';
import patcher from 'livestyle-patcher';
import app from './app';

const commander = patcher(app.client, {worker: './worker.js'});

commander.worker.addEventListener('message', function(message) {
	var payload = message.data;
	if (payload.name === 'init') {
		return console.log('%c%s', 'color:green;font-size:1.1em;font-weight:bold;', payload.data);
	}

	if (payload.status === 'error') {
		console.error(payload.data);
	}
});

/**
 * Sends command to LiveStyle worker directly
 * @param  {String} name Command name
 * @param  {Object} data Command payload
 * @return {Promise}
 */
export default function sendCommand(name, data) {
	return new Promise((resolve, reject) => {
		commander.add(name, data, (status, response) => {
			status === 'error' ? reject(error('EWORKERERROR', response)) : resolve(response);
		});
	});
}

/**
 * Apply patches to given content
 * @param  {String} content
 * @param  {Array} patches
 * @return {Promise}
 */
export function patch(content, patches) {
	return sendCommand('apply-patch', {
		uri: `resource${Date.now()}`, // random name to skip command optimization
		syntax: 'css',
		content,
		patches
	});
}

/**
 * Calculate diff between two content samples
 * @param  {String} oldContent
 * @param  {String} newContent
 * @return {Promise}
 */
export function diff(oldContent, newContent) {
	return sendCommand('calculate-diff', {
		uri: `resource${Date.now()}`, // random name to skip command optimization
		syntax: 'css',
		content: newContent,
		previous: oldContent
	});
}
