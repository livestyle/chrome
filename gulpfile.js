var gulp = require('gulp');
var uglify = require('gulp-uglify');
var streamify = require('gulp-streamify');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var through = require('through2');

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

gulp.task('worker', function() {
	return browserify({
		entries: './node_modules/livestyle-patcher/lib/worker.js',
		detectGlobals: false
	})
	.bundle()
	.pipe(cleanup())
	.pipe(source('worker.js'))
	// .pipe(streamify(uglify()))
	.pipe(gulp.dest('./out'));
});

gulp.task('watch', function() {
	gulp.watch(['./node_modules/livestyle-patcher/lib/*.js'], ['worker']);
});

gulp.task('default', ['worker']);