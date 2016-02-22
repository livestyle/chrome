'use strict';

const path = require('path');
const stream = require('stream');
const browserify = require('browserify');
const watchify = require('watchify');

const _bundles = {};
const defaultOptions = {
	debug: false,
	detectGlobals: true,
	babelify: true,
	babelOptions: {
		global: true,
		presets: [require('babel-preset-es2015')],
		plugins: [
			[require('babel-plugin-transform-react-jsx'), {pragma: 'tr'}],
			require('babel-plugin-transform-object-rest-spread'),
			require('babel-plugin-transform-node-env-inline')
		]
	}
};

module.exports = function(options) {
	return transform(function(file, enc, next) {
		file.contents = jsBundle(file, options)
		.on('error', err => this.emit('error', err));
		next(null, file);
	});
}

function extend() {
	var args = Array.prototype.slice.call(arguments, 0);
	return args.filter(Boolean).reduce((r, src) => Object.assign(r, src), {});
}

function transform(transform, flush) {
	return new stream.Transform({transform, flush, objectMode: true});
}

function jsBundle(file, options) {
	options = options || {};

	if (!_bundles[file.path]) {
		options = makeOptions(file, options);

		var b = browserify(options);
		if (options.watch) {
			b.plugin(watchify);
		}

		if (options.babelify) {
			b = b.transform('babelify', options.babelOptions)
		}

		_bundles[file.path] = b;
	}

	return _bundles[file.path].bundle();
}

function makeOptions(file, options) {
	options = options || {};
	var babelOptions = extend(defaultOptions.babelOptions, options.babelOptions || {});
	options = extend({entries: [file.path]}, defaultOptions,  options, {babelOptions});

	if (options.standalone === true) {
		options.standalone = path.basename(file.path)
			.replace(/\.\w+/, '')
			.replace(/\-(\w)/g, function(str, c) {
				return c.toUpperCase();
			});
	}

	if (options.watch) {
		options = extend(options, {
			cache: {},
			packageCache: {}
		});
	}

	return options;
}
