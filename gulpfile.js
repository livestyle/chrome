var gulp = require('gulp');
var uglify = require('gulp-uglify');
var streamify = require('gulp-streamify');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var through = require('through2');

var allModules = ['worker', 'cssom-patcher', 'client', 'patcher'];

function cleanup() {
	return through.obj(function(chunk, enc, next) {
		var str = chunk.toString();
		if (str.indexOf(__dirname)) {
			chunk = new Buffer(str.replace(__dirname, ''));
		}
		this.push(chunk);
		next();
	});
}

function browserifyFile(src, dest, moduleName) {
	return browserify({
		entries: src,
		detectGlobals: false,
		standalone: moduleName
	})
	.bundle()
	.pipe(cleanup())
	.pipe(source(dest))
	// .pipe(streamify(uglify()))
	.pipe(gulp.dest('./out'));
}

gulp.task('worker', function() {
	return browserifyFile('./node_modules/livestyle-patcher/lib/worker.js', 'worker.js');
});

gulp.task('cssom-patcher', function() {
	return browserifyFile('./node_modules/livestyle-cssom-patcher/index.js', 'cssom-patcher.js', 'livestyleCSSOM');
});

gulp.task('client', function() {
	return browserifyFile('./node_modules/livestyle-client/index.js', 'client.js', 'livestyleClient');
});

gulp.task('patcher', function() {
	return browserifyFile('./node_modules/livestyle-patcher/index.js', 'patcher.js', 'livestylePatcher');
});

/**
 * Simple extension builder, used for demo purposes
 * only (Chrome extension perfectly works from source, it
 * requires just a `default` task to run first)
 */
gulp.task('extension-files', allModules, function() {
	return gulp.src(['{lib,ui}/**/*.*', 'manifest.json', './out/*.js', './node_modules/requirejs/require.js'], {base: './'})
	.pipe(gulp.dest('./out/livestyle-alpha'));
});

gulp.task('watch', function() {
	gulp.watch(['./node_modules/{livestyle-patcher,livestyle-cssom-patcher}/**/*.js'], allModules);
});

gulp.task('default', allModules);