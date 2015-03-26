var path = require('path');
var gulp = require('gulp');
var jsBundler = require('js-bundler');
var notifier = require('node-notifier');
var through = require('through2');

var srcOptions = {base: './'};
var outPath = './out';
var production = process.argv.indexOf('--production') !== -1;

function cleanup() {
	return through.obj(function(file, enc, next) {
		var str = file.contents.toString();
		if (str.indexOf(__dirname)) {
			file.contents = new Buffer(str.replace(__dirname, ''));
		}
		next(null, file);
	});
}

function js(options) {
	return jsBundler(options).on('error', function(err) {
		notifier.notify({
			title: 'Error', 
			message: err,
			sound: true
		});
		console.error(err.stack || err);
		this.emit('end');
	});
}

gulp.task('js', function() {
	return gulp.src('./scripts/*.js', srcOptions)
		.pipe(js({
			standalone: true,
			sourceMap: !production,
			detectGlobals: false,
		}))
		.pipe(cleanup())
		.pipe(gulp.dest(outPath))
});

gulp.task('assets', function() {
	return gulp.src(['./{icon,styles}/**', './*.html', './manifest.json'], srcOptions)
		.pipe(gulp.dest(outPath));
});


gulp.task('watch', function() {
	gulp.watch('./scripts/**/*.js', ['js']);
	gulp.watch(['./{icon,styles}/**', './*.html', './manifest.json'], ['assets']);
});

gulp.task('default', ['js', 'assets']);