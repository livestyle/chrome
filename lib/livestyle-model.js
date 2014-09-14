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
	var eventMixin = require('./event-mixin');

	function pathLookup(path) {
		return path.split('/').filter(function(chunk) {
			return !!chunk;
		});
	}

	function guessAssoc(list, file) {
		var fileLookup = pathLookup(file).reverse();
		var candidates = list.map(function(path) {
			return {
				path: path,
				lookup: pathLookup(path)
			};
		});

		var chunk, prevCandidates;
		for (var i = 0, il = fileLookup.length; i < il; i++) {
			prevCandidates = candidates;
			candidates = candidates.filter(function(candidate) {
				return fileLookup[i] == candidate.lookup.pop();
			});

			if (candidates.length === 1) {
				break;
			} else if (!candidates.length) {
				// empty candidates list on first pass means we
				// didn’t found anything at all
				candidates = i ? prevCandidates : null;
				break;
			}
		}

		if (candidates && candidates.length) {
			return candidates[0].path;
		}
	}

	function LiveStyleModel(id) {
		this.id = id;
		Model.call(this);
		this.on('change:browserFiles change:editorFiles change:assocs', function() {
			this.trigger('update');
		})
		.on('all', function(name) {
			// pass all inner model events to the global dispatcher
			var args = [name, this].concat(Array.prototype.slice.call(arguments, 1));
			LiveStyleModel.trigger.apply(LiveStyleModel, args);
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
			var result = {};
			var realAssocs = this.get('assocs') || {};
			var browserFiles = this.get('browserFiles') || [];
			var editorFiles = this.get('editorFiles') || [];

			browserFiles.forEach(function(browserFile) {
				var editorFile = realAssocs[browserFile];
				if (!editorFile) {
					// user didn’t picked association yet: guess it
					editorFile = ~editorFiles.indexOf(browserFile) ? browserFile : guessAssoc(editorFiles, browserFile);
				} else if (!~editorFiles.indexOf(editorFile)) {
					// we have association but user didn’t opened it yet:
					// assume there’s no association
					editorFile = null;
				}
				result[browserFile] = editorFile;
			});

			return result;
		}
	});
});