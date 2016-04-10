'use strict';

const gulp = require('gulp');
const js = require('./gulp-tasks/js-bundle');
const notify = require('./gulp-tasks/notify');

const isWatching = ~process.argv.indexOf('watch');
const production = ~process.argv.indexOf('--production') || process.env.NODE_ENV === 'production';
const src = (pattern, options) => gulp.src(pattern, Object.assign({base: './src2'}, options || {}));
const dest = (pattern) => gulp.dest(pattern || './out2');

gulp.task('script', () => {
	return src('./src2/*.js')
	.pipe(js({
		debug: !production,
		watch: isWatching
	})).on('error', notify('JavaScript Error'))
	.pipe(dest())
});

gulp.task('assets', ['resources'], () => {
	return src(['./src2/*.{html,json}', './src2/assets/*.*']).pipe(dest());
});

gulp.task('resources', () => {
	return gulp.src('./{icon,styles}/**').pipe(dest());
});

gulp.task('watch', ['build'], () => {
	gulp.watch(['./src2/**/*.js'], ['script']);
	gulp.watch(['./{icon,styles}/**'], ['resources']);
	gulp.watch(['./src2/*.{html,json}', './src2/assets/*.*'], ['assets']);
});

gulp.task('build', ['script', 'assets']);
gulp.task('default', ['watch']);
