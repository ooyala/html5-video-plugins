// Build automation
// Require sudo npm install -g gulp
// For dev, initiate watch by executing either `gulp` or `gulp watch`

var gulp = require('gulp'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    gutil = require('gulp-util'),
    uglify = require('gulp-uglify'),
    shell = require('gulp-shell'),
    rename = require('gulp-rename');
    listFiles = require('file-lister');

var path = {
  mainJs: ['./src/main/js/'],
  bitJs: ['./src/bit/js/']
};

var main_html5_fn = function() {
  uglify_fn(path.mainJs);
}

var bit_fn = function() {
  uglify_fn(path.bitJs);
  gulp.src(['./src/bit/lib/*'])
    .pipe(gulp.dest('./build'));
}

var uglify_fn = function(srcPath) {
  var bundleThis = function(srcArray) {
    for (index in srcArray) {
      var sourceFile = srcArray[index];
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
    }
  };

  listFiles(srcPath, function(error, files) {
    if (error) {
      console.log(error);
    } else {
      var filteredList = files.filter(checkFileExtension.bind(this,".js"));
      bundleThis(filteredList);
    }
  });
}

var checkFileExtension = function(extension, fileName) {
    if (!fileName || fileName.length < extension.length) {
      return false;
    }

    return (fileName.lastIndexOf(extension) == fileName.length - extension.length);
}

var getFileNameFromPath = function(path) {
  var start = path.lastIndexOf('/') + 1;
  return path.substring(start);
}

// Build All, TODO: add task build_osmf
gulp.task('build', ['build_main_html5', 'build_bit']);
gulp.task('build_main_html5', main_html5_fn);
gulp.task('build_bit', bit_fn);
gulp.task('test', shell.task(['jest --verbose']));

// Initiate a watch
gulp.task('watch', function() {
  gulp.watch(path.scripts, ['browserify']);
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['build']);

