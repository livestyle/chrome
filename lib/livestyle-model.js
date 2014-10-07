/**
 * LiveStyle model: responsible for storing info about
 * LiveStyle state for context page
 */
if (typeof module === 'object' && typeof define !== 'function') {
	var define = function (factory) {
		module.exports = factory(require, exports, module);
	};
}

define(function(require, exports, module) {
	var Model = require('./model');
	var utils = require('./utils');
	var associations = require('./associations');
	var eventMixin = require('./event-mixin');

	function LiveStyleModel(id) {
		this.id = id;
		this.lastUpdate = Date.now();
		Model.call(this);
		this
		.on('change:browserFiles change:editorFiles change:assocs change:userStylesheets', function() {
			this.trigger('update');
		})
		.on('all', function() {
			// pass all inner model events to the global dispatcher
			LiveStyleModel.emit.apply(LiveStyleModel, arguments);
		});
	}

	utils.extend(LiveStyleModel, eventMixin);

	return utils.inherit(LiveStyleModel, Model, {
		/**
		 * Returns virtual file associations. Unlike “real“ associations,
		 * where user explicilty pick files, virtual ones contains guessed
		 * associtiations for files user didn’t picked yet
		 * @return {Object}
		 */
		associations: function() {
			var browserFiles = this.get('browserFiles') || [];
			var userStylesheets = Object.keys(this.get('userStylesheets') || {});
			return associations(
				browserFiles.concat(userStylesheets), 
				this.get('editorFiles'), 
				this.get('assocs')
			);
		}
	});
});