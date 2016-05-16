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
  flashOSMFJs: './src/osmf/js/osmf_flash.js',
  flashAkamaiJs: './src/akamai/js/akamaiHD_flash.js'
};

var main_html5_fn = function() {
  uglify_fn(path.mainJs);
}

var osmf_fn = function() {
  uglify_fn(path.flashOSMFJs);
}

var akamai_fn = function() {
  uglify_fn(path.flashAkamaiJs);
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

gulp.task('build_flash_osmf', function(callback) {
    exec("ant -buildfile build_flash.xml -Dbuild=build/classes build-CCswc", function(err) {
      if (err) console.log("Error occured in building the CC : " + err);
      else{
        exec("ant -buildfile build_flash.xml -Dbuild=build/classes build-osmf", function(err) { 
          if (err) console.log("Error occured in building osmf plugin : " + err);
          else {osmf_fn();}
        });
      }
      callback();
    });
});

gulp.task('build_flash_akamai', function(callback) {
    exec("ant -buildfile build_flash.xml -Dbuild=build/classes build-akamai", function(err) {
      if (err) console.log("Error occured in building akamai plugin : " + err);
      else {akamai_fn();}
      callback();
    });
});

gulp.task('build', ['init_module', 'build_flash_osmf', 'build_flash_akamai'], function() {
  main_html5_fn();
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

