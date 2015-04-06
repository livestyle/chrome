var path = require('path');
var gulp = require('gulp');
var zip = require('gulp-zip');
var jsBundler = require('js-bundler');
var notifier = require('node-notifier');
var through = require('through2');

var production = process.argv.indexOf('--production') !== -1;
var dest = './out';
var src = {
	js: './scripts/*.js',
	assets: ['./{icon,styles}/**', './*.html', './manifest.json'],
	options: {base: './'}
};

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
	return gulp.src(src.js, src.options)
		.pipe(js({
			standalone: true,
			sourceMap: !production,
			detectGlobals: false
		}))
		.pipe(cleanup())
		.pipe(gulp.dest(dest))
});

gulp.task('assets', function() {
	return gulp.src(src.assets, src.options)
		.pipe(gulp.dest(dest));
});

gulp.task('pack', ['build'], function() {
	return gulp.src(path.join(dest, '**'), {ignore: '*.zip'})
		.pipe(zip('livestyle-alpha.zip'))
		.pipe(gulp.dest(dest));
});

gulp.task('watch', function() {
	jsBundler.watch({sourceMap: true, uglify: false});
	gulp.watch('./scripts/**/*.js', ['js']);
	gulp.watch(src.assets, ['assets']);
});

gulp.task('build', ['js', 'assets']);
gulp.task('default', ['build']);