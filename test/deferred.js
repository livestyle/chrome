var assert = require('assert');
require('babel/register');
var deferred = require('../scripts/lib/deferred');

describe('Deferred', function() {
	it('resolve', function() {
		var resolved = 0, rejected = 0;
		var d = deferred()
		.then(function() {resolved++;}, function() {rejected++;})
		.resolve()
		.then(function() {resolved++;});

		assert.equal(resolved, 2);
		assert.equal(rejected, 0);
		assert.equal(d.state, 'fulfilled');
	});

	it('reject', function() {
		var resolved = 0, rejected = 0;
		var d = deferred()
		.then(function() {resolved++;}, function() {rejected++;})
		.reject()
		.then(null, function() {rejected++;});

		assert.equal(resolved, 0);
		assert.equal(rejected, 2);
		assert.equal(d.state, 'rejected');
	});

	it('preserve state', function() {
		var resolved = 0, rejected = 0;
		var d = deferred()
		.resolve()
		.reject()
		.then(function() {resolved++;}, function() {rejected++;});

		assert.equal(resolved, 1);
		assert.equal(rejected, 0);
		assert.equal(d.state, 'fulfilled');
	});

	it('default handler', function() {
		var d = deferred(function() {
			this.resolve();
		});
		assert.equal(d.state, 'fulfilled');
	});

	it('arguments passing', function() {
		var result = '';
		var d = deferred()
		.then(function(a, b) {result = a + ':' + b;}, function(a, b) {result = b + ':' + a;})
		.resolve('foo', 'bar');

		assert.equal(result, 'foo:bar');
	});

	it('async', function(done) {
		var d = deferred().then(function() {
			assert('ok');
			done();
		});

		setTimeout(d.resolve, 10);
	});
});