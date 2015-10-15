/**
 * LiveStyle model: responsible for storing info about
 * LiveStyle state for context page
 */
'use strict';

import Model from './model';
import EventEmitter from './event-emitter';
import associations from './associations';

var emitter = new EventEmitter();

export default class LiveStyleModel extends Model {
	constructor(id) {
		super();
		this.id = id;
		this.lastUpdate = Date.now();
		this
		.on('change:browserFiles change:editorFiles change:assocs change:userStylesheets', function() {
			this.emit('update');
		})
		.on('all', function() {
			// pass all inner model events to the global dispatcher
			LiveStyleModel.emit.apply(LiveStyleModel, arguments);
		});
	}

	/**
	 * Returns virtual file associations. Unlike “real“ associations,
	 * where user explicitly pick files, virtual ones contains guessed
	 * associations for files user didn’t picked yet
	 * @return {Object}
	 */
	associations() {
		var browserFiles = this.get('browserFiles') || [];
		var userStylesheets = Object.keys(this.get('userStylesheets') || {});
		return associations(
			browserFiles.concat(userStylesheets), 
			this.get('editorFiles'), 
			this.get('assocs')
		);
	}
}

LiveStyleModel.on = emitter.on.bind(emitter);
LiveStyleModel.off = emitter.off.bind(emitter);
LiveStyleModel.emit = emitter.emit.bind(emitter);