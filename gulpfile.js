// Build automation
// Require sudo npm install -g gulp
// For dev, initiate watch by executing either `gulp` or `gulp watch`

var gulp = require('gulp'),
    browserify = require('browserify'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    uglify = require('gulp-uglify'),
    shell = require('gulp-shell'),
    rename = require('gulp-rename'),
    exec = require('child_process').exec;

var path = {
  mainJs: './src/main/js/main_html5.js',
  bitJs: './src/bit/js/bit_wrapper.js'
};

var main_html5_fn = function() {
  uglify_fn(path.mainJs);
}

var bit_fn = function() {
  uglify_fn(path.bitJs);
  gulp.src(['./src/bit/lib/*'])
    .pipe(gulp.dest('./build'));
}

var uglify_fn = function(srcFile) {
  var b = browserify({
    entries: srcFile,
    debug: false,
  });

  b.bundle()
    .pipe(source(getFileNameFromPath(srcFile)))
    .pipe(buffer())
    .pipe(gulp.dest('./build/'))
    .pipe(uglify())
    .pipe(rename({
      extname: '.min.js'
    }))
    .pipe(gulp.dest('./build/'));
}

var getFileNameFromPath = function(path) {
  var start = path.lastIndexOf('/') + 1;
  return path.substring(start);
}

// Dependency task
gulp.task('init_module', function(callback) {
  exec("git submodule update --init && cd html5-common && npm install && cd ..", function(err) {
    if (err) return callback(err);
    callback();
  });
});

// Build All, TODO: add task build_osmf
gulp.task('build', ['init_module'], function() {
  main_html5_fn();
  bit_fn();
});

gulp.task('test', shell.task(['jest --verbose']));

// Initiate a watch
gulp.task('watch', function() {
  gulp.watch("src/**/*", ['build']);
});

// The default task (called when you run `gulp` from cli)
gulp.task('default', ['build']);

// Generate documentation
gulp.task("docs", shell.task("./node_modules/.bin/jsdoc -c ./jsdoc_conf.json"));

