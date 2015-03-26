var assert = require('assert');
require('babel/register');
var compactPaths = require('../scripts/helpers/compact-paths');

describe('Compact paths', function() {
	function pluck(items, key) {
		return items.map(function(item) {
			return item[key];
		});
	}

	function process(paths) {
		return pluck(compactPaths(paths), 'label');
	}

	it('keep names', function() {
		assert.deepEqual(
			process(['/path/to/file1.css', 'path/to/file2.css', 'file3.css']), 
			['file1.css', 'file2.css', 'file3.css']
		);
	});

	it('keep partial names', function() {
		assert.deepEqual(
			process(['/path/to1/file.css', 'path/to2/file.css', 'file3.css']), 
			['to1/file.css', 'to2/file.css', 'file3.css']
		);
	});

	it('keep full names', function() {
		assert.deepEqual(
			process(['/path1/to/file.css', 'path2/to/file.css', 'file3.css']), 
			['/path1/to/file.css', 'path2/to/file.css', 'file3.css']
		);
	});

	it('Windows path separator', function() {
		assert.deepEqual(
			process(['C:\\path\\to\\file1.css', 'path/to/file2.css', 'file3.css']), 
			['file1.css', 'file2.css', 'file3.css']
		);
	});
});