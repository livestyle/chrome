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

	function LiveStyleModel(id) {
		this.id = id;
		Model.call(this);
		this.on('change:browserFiles change:editorFiles change:assocs', function() {
			this.trigger('update');
		});
	}

	return utils.inherit(LiveStyleModel, Model, {
		/**
		 * Returns virtual file associations. Unlike “real“ associations,
		 * where user explicilty pick files, virtual ones contains guessed
		 * associtiations for files user didn’t picked yet
		 * @return {Object}
		 */
		associations: function() {
			return associations(
				this.get('browserFiles'), 
				this.get('editorFiles'), 
				this.get('assocs')
			);
		}
	});
});