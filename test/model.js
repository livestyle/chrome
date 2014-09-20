var assert = require('assert');
var Model = require('../lib/livestyle-model');

describe('LiveStyle Model', function() {
	it('get & set attributes', function() {
		var model = new Model();
		model.set('enabled', true);
		model.set('browserFiles', ['a.css', 'b.css']);

		assert.equal(model.get('enabled'), true);
		assert.deepEqual(model.get('browserFiles'), ['a.css', 'b.css']);
	});

	it('event dispatching', function() {
		var model = new Model();
		var update = 0, enabled = 0, browserFiles = 0;
		model.on('change:enabled', function() {
			enabled++;
		})
		.on('change:browserFiles', function() {
			browserFiles++;
		})
		.on('update', function() {
			// cumulative event
			update++;
		});

		model
			.set('enabled', true)
			.set('enabled', true)
			.set('browserFiles', ['a', 'b'])
			.set('browserFiles', ['a', 'b']);

		assert.equal(update, 1);
		assert.equal(enabled, 1);
		assert.equal(browserFiles, 1);
	});

	// it('global event dispatching', function() {
	// 	var m1 = new Model('m1');
	// 	var m2 = new Model('m2');

	// 	var changes = {}
	// 	Model.on('change:editorFiles update', function(model) {
	// 		if (!changes[model.id]) {
	// 			changes[model.id] = 0;
	// 		}

	// 		changes[model.id]++;
	// 	});

	// 	m1.set('editorFiles', ['a', 'b']);
	// 	m2.set('editorFiles', ['c', 'd']);

	// 	assert.deepEqual(changes, {m1: 2, m2: 2});
	// });

	it('file assocs', function() {
		var model = new Model();
		model.set('browserFiles', [
			'/assets/css/file1.css', 
			'/assets/css/file2.css', 
			'/assets/css/file3.css',
			'/assets/css/file4.css',
		]);

		model.set('editorFiles', [
			'/assets/css/file1.css',

			'/files/css2/file2.css',
			'/files/css3/file2.css',

			'/assets/css/foo.css'
		]);

		model.set('assocs', {'/assets/css/file4.css': '/assets/css/foo.css'});

		var assocs = model.associations();

		// strict guessing
		assert.equal(assocs['/assets/css/file1.css'], '/assets/css/file1.css');

		// fuzzy guessing
		assert.equal(assocs['/assets/css/file2.css'], '/files/css2/file2.css');

		// no match
		assert.equal(assocs['/assets/css/file3.css'], undefined);

		// explicit association
		assert.equal(assocs['/assets/css/file4.css'], '/assets/css/foo.css');
	});
});