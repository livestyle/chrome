'use strict';

const gulp = require('gulp');
const js = require('./gulp-tasks/js-bundle');
const notify = require('./gulp-tasks/notify');

const isWatching = ~process.argv.indexOf('watch');
const production = ~process.argv.indexOf('--production') || process.env.NODE_ENV === 'production';
const src = (pattern, options) => gulp.src(pattern, Object.assign({base: './src'}, options || {}));
const dest = (pattern) => gulp.dest(pattern || './out2');

gulp.task('script', () => {
	return src('./src/*.js')
	.pipe(js({
		debug: !production,
		watch: isWatching
	})).on('error', notify('JavaScript Error'))
	.pipe(dest())
});

gulp.task('assets', () => {
	return src('./src/*.{html,json}').pipe(dest());
});

gulp.task('watch', ['build'], () => {
	gulp.watch([ './src/**/*.js'], ['script']);
});

gulp.task('build', ['script', 'assets']);
gulp.task('default', ['watch']);
