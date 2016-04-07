'use strict';
const assert = require('assert');
require('babel-register');
const utils = require('../src2/lib/utils');

describe('Utils', () => {
	it('serialize', () => {
		var s = utils.serialize;
		assert.deepEqual(s([1, 'a', null]), [1, 'a', null]);
		assert.deepEqual(s({a: 1, b: 'c'}), {a: 1, b: 'c'});
		assert.deepEqual(
			s({a: new Map().set('k', new Set(['1', [2]]))}),
			{a: {k: ['1', [2]]}}
		);
	});
});
