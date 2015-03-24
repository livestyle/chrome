/**
 * LiveStyle model: responsible for storing info about
 * LiveStyle state for context page
 */
import Model from './model';
import EventEmitter from './event-emitter';
import {extend} from './utils';
import associations from './associations';

export default class LiveStyleModel extends Model {
	constructor(id) {
		this.id = id;
		this.lastUpdate = Date.now();
		super();
		this
		.on('change:browserFiles change:editorFiles change:assocs change:userStylesheets', function() {
			this.trigger('update');
		})
		.on('all', function() {
			// pass all inner model events to the global dispatcher
			LiveStyleModel.emit.apply(LiveStyleModel, arguments);
		});
	}

	/**
	 * Returns virtual file associations. Unlike “real“ associations,
	 * where user explicilty pick files, virtual ones contains guessed
	 * associtiations for files user didn’t picked yet
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

extend(LiveStyleModel, EventEmitter.prototype);