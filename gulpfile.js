// Build automation
// Require sudo npm install -g gulp
// For dev, initiate watch by executing either `gulp` or `gulp watch`

var gulp = require('gulp'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    uglify = require('gulp-uglify'),
    shell = require('gulp-shell'),
    rename = require('gulp-rename');

// Build All
gulp.task('build', ['build_main_html5']);

gulp.task('test', shell.task(['jest --verbose']));

// Initiate a watch
gulp.task('watch', function() {
  gulp.watch(path.scripts, ['build']);
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['build']);

gulp.task('build_main_html5', function() {
  var sourceFile = './src/main/js/main_html5.js';
  var b = browserify({
    entries: sourceFile,
    debug: false,
  });

  b.bundle()
    .pipe(source(getFileNameFromPath(sourceFile)))
    .pipe(buffer())
    .pipe(gulp.dest('./build/'))
    .pipe(uglify())
    .pipe(rename({
      extname: '.min.js'
    }))
    .pipe(gulp.dest('./build/'))
});

// helper functions
var getFileNameFromPath = function(path)
{
  var start = path.lastIndexOf('/') + 1;
  return path.substring(start);
}
