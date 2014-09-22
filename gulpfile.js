var gulp = require('gulp');
var browserify = require('gulp-browserify');
var uglify = require('gulp-uglify');

gulp.task('worker', function() {
	return gulp.src('./node_modules/livestyle-patcher/lib/worker.js')
		.pipe(browserify({
			insertGlobals : false,
			debug : true
		}))
		// .pipe(uglify())
		.pipe(gulp.dest('./out'));
});

gulp.task('watch', function() {
	gulp.watch(['./node_modules/livestyle-patcher/lib/*.js'], ['worker']);
});

gulp.task('default', ['worker']);