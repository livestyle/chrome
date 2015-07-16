'use strict';

var assert = require('assert');
var _client = require('livestyle-client');
require('babel/register');
var client = require('../scripts/lib/client-expect');

describe('Client Expect', function() {
	var oldStatus = _client.status;
	before(function() {
		_client._setStatus('connected');
	});
	after(function() {
		_client._setStatus(oldStatus);
	});

	it('send', function(done) {
		client.on('message-send', function onMessage(name) {
			assert.equal(name, 'ping');
			client.off('message-send', onMessage);
			done();
		});

		client.send('ping');
	});

	it('send & expect (success)', function(done) {
		var onMessage = function(name) {
			if (name === 'ping') {
				client.emit('message-receive', 'pong');
			}
		};

		client.on('message-send', onMessage);

		client.send('ping').expect('pong').then(function() {
			client.off('message-send', onMessage);
			done();
		}, done);
	});

	it('send & expect (fail)', function(done) {
		client.send('ping').expect('pong', 100).then(function() {
			done(new Error('Should not resolve'));
		}, function(err) {
			assert(err);
			assert.equal(err.messageName, 'pong');
			done();
		});
	});

	it('expect after send', function(done) {
		var obj = client.send('ping');
		setTimeout(function() {
			obj.expect('pong').then(function() {
				done(new Error('Should not resolve'));
			}, function(err) {
				assert(err);
				assert(err.message.indexOf('already sent') !== -1);
				done();
			});
		}, 10);
	});

	it('validate', function(done) {
		var onMessage = function(name) {
			if (name === 'ping') {
				client.emit('message-receive', 'pong', {a: 1});

				setTimeout(function() {
					client.emit('message-receive', 'pong', {a: 2, foo: 'bar'});
				}, 100);
			}
		};

		client.on('message-send', onMessage);
		client.send('ping')
		.expect('pong', function(data) {
			return data.a === 2;
		})
		.then(function(data) {
			assert.equal(data.a, 2);
			assert.equal(data.foo, 'bar');
			client.off('message-send', onMessage);
			done();
		}, done);
	});
});