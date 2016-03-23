'use strict';
const assert = require('assert');
require('babel-register');
const utils = require('../src/lib/utils');

describe('Replace Deep Key', () => {
	it('plain objects', () => {
		var obj = {
			a1: {b1: {c1: {d1: 1, e1: 'foo'}}},
			a2: {b2: {c2: {d2: 1, e2: 'foo'}}, b2_2: {c2_2: 'bar'}},
			a3: {b3: {c3: {d3: 1, e3: 'foo'}}}
		};

		var replaced = utils.replaceValue(obj, 'a2.b2.c2.d2', 5);
		assert(obj !== replaced);
		assert(obj.a1 === replaced.a1);
		assert(obj.a1.b1 === replaced.a1.b1);
		assert(obj.a2 !== replaced.a2);
		assert(obj.a2.b2 !== replaced.a2.b2);
		assert(obj.a2.b2_2 === replaced.a2.b2_2);
		assert(obj.a2.b2.c2 !== replaced.a2.b2.c2);
		assert(replaced.a2.b2.c2.d2 === 5);

		replaced = utils.replaceValue(obj, 'a3', 'baz');
		assert(obj !== replaced);
		assert(obj.a1 === replaced.a1);
		assert(obj.a2 === replaced.a2);
		assert(obj.a1.b1 === replaced.a1.b1);
		assert(obj.a2.b2 === replaced.a2.b2);
		assert(replaced.a3 === 'baz');
	});

	it.only('mixed data', () => {
		var obj = {
			a1: {
				b1: new Map()
				.set('c1', {d1: 1, e1: 'foo'})
			},
			a2: {
				b2: new Map().set('c2', {d2: 1, e2: 'foo'}),
				b2_2: {c2_2: 'bar'}
			},
			a3: {
				b3: new Map().set('c3', {d3: 1, e3: 'foo'})
			}
		};

		var replaced = utils.replaceValue(obj, 'a2.b2.c2.d2', 5);
		assert(obj !== replaced);
		assert(obj.a1 === replaced.a1);
		assert(obj.a1.b1 === replaced.a1.b1);
		assert(obj.a2 !== replaced.a2);
		assert(obj.a2.b2 !== replaced.a2.b2);
		assert(obj.a2.b2_2 === replaced.a2.b2_2);
		assert(obj.a2.b2.get('c2') !== replaced.a2.b2.get('c2'));
		assert(replaced.a2.b2.get('c2').d2 === 5);

		replaced = utils.replaceValue(obj, 'a3', 'baz');
		assert(obj !== replaced);
		assert(obj.a1 === replaced.a1);
		assert(obj.a2 === replaced.a2);
		assert(obj.a1.b1 === replaced.a1.b1);
		assert(obj.a2.b2 === replaced.a2.b2);
		assert(replaced.a3 === 'baz');
	});
});
