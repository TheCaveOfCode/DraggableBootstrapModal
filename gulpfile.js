var argv = require('minimist')(process.argv.slice(2));
var autoprefixer = require('gulp-autoprefixer');
var browserSync = require('browser-sync').create();
var changed = require('gulp-changed');
var concat = require('gulp-concat');
var debug = require('gulp-debug');
var flatten = require('gulp-flatten');
var gulp = require('gulp');
var gulpif = require('gulp-if');
var imagemin = require('gulp-imagemin');
var jshint = require('gulp-jshint');
var lazypipe = require('lazypipe');
var less = require('gulp-less');
var merge = require('merge-stream');
var minifyCss = require('gulp-clean-css');
var minifyHtml = require('gulp-htmlmin');
var plumber = require('gulp-plumber');
var rev = require('gulp-rev');
var revReplace = require('gulp-rev-replace');
var runSequence = require('run-sequence');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var ts = require('gulp-typescript');
var tslint = require('gulp-tslint');
var typings = require('gulp-typings');
var uglify = require('gulp-uglify');

var manifest = require('asset-builder')('./manifest.json');

var path = manifest.paths;
var globs = manifest.globs;
var project = manifest.getProjectGlobs();

// path to the compiled assets manifest in the dist directory
var revManifest = path.dist + 'assets.json';

var config = manifest.config || {};

// production flags
var enabled = {
    // enable static asset revisioning
    rev: argv.production,
    // disable source maps
    maps: !argv.production,
    // enable minifaction
    minimize: argv.production,
    // fail styles task on error
    failStyleTask: !argv.production,
    // fail due to JSHint warnings
    failJSHint: argv.production,
    // fail due to TSLint warnings
    failTSLint: argv.production,
    // strip debug statments from javascript
    stripJSDebug: argv.production
};

// css processing pipeline
var cssTasks = function(filename) {
    return lazypipe()
        .pipe(function() {
            return gulpif(enabled.failStyleTask, plumber());
        })
        .pipe(function() {
            return gulpif(enabled.maps, sourcemaps.init());
        })
        .pipe(function() {
            return gulpif('*.less', less());
        })
        .pipe(function() {
            return gulpif('*.scss', sass({
                outputStyle: 'nested', // libsass doesn't support expanded yet
                precision: 10,
                includePaths: ['.'],
                errLogToConsole: enabled.failStyleTask
            }));
        })
        .pipe(concat, filename)
        .pipe(autoprefixer, {
            browsers: [
                'last 2 versions',
                'android 4',
                'opera 12'
            ]
        })
        .pipe(function() {
            return gulpif(enabled.minimize, minifyCss({
                advanced: false,
                rebase: false
            }));
        })
        .pipe(function() {
            return gulpif(enabled.rev, rev());
        })
        .pipe(function() {
            return gulpif(enabled.maps, sourcemaps.write('.'));
        })();
};

// write to rev manifest
// if there are any revved files then write them to the rev manifest
var writeToManifest = function(directory) {
    return lazypipe()
        .pipe(gulp.dest, path.dist + directory)
        .pipe(browserSync.stream, { match: '**/*.{js,css}' })
        .pipe(rev.manifest, revManifest, {
            base: path.dist,
            merge: true
        })
        .pipe(gulp.dest, path.dist)();
};

// gulp styles
// wires bower dependencies, compiles, combines
// if --production flag is set precompiler errors fails task
gulp.task('styles', function() {
    var wiredep = require('wiredep').stream;
    var merged = merge();
    manifest.forEachDependency('css', function(dep) {
        var cssTasksInstance = cssTasks(dep.name);
        if (enabled.failStyleTask) {
            cssTasksInstance.on('error', function(err) {
                console.error(err.message);
                this.emit('end');
            });
        }
        merged.add(gulp.src(dep.globs)
            .pipe(wiredep())
            .pipe(cssTasksInstance));
    });
    return merged
        .pipe(writeToManifest(path.styles));
});

// js processing pipeline
var jsTasks = function(filename) {
    return lazypipe()
        .pipe(function() {
            return gulpif(enabled.maps, sourcemaps.init());
        })
        .pipe(concat, filename)
        .pipe(function() {
            return gulpif(enabled.minimize, uglify({
                compress: {
                    'drop_debugger': enabled.stripJSDebug
                }
            }));
        })
        .pipe(function() {
            return gulpif(enabled.rev, rev());
        })
        .pipe(function() {
            return gulpif(enabled.maps, sourcemaps.write('.'));
        })();
};

// gulp scripts
// lints, compiles, combines js and ts files
gulp.task('scripts', ['jshint', 'tslint', 'typescript'], function() {
    var merged = merge();
    manifest.forEachDependency('js', function(dep) {
        merged.add(
            gulp.src(dep.globs, { base: 'scripts' })
                .pipe(jsTasks(dep.name))
        );
    });
    return merged
        .pipe(writeToManifest('scripts'));
});

// gulp typescript
// compiles to commonjs
gulp.task('typescript', function() {
    return gulp.src(project.typescript)
        .pipe(ts({
            module: 'commonjs',
            removeComments: true
        }))
        .js
        .pipe(gulp.dest(path.build));
});

// gulp jshint
// lints configuration JSON and project JS
// if --production flag is set errors fails task
gulp.task('jshint', function() {
    return gulp.src(project.javascript.concat(
        [
            'package.json',
            'bower.json',
            'typings.json',
            'manifest.json',
            'gulpfile.js'
        ]))
        .pipe(jshint())
        .pipe(jshint.reporter('jshint-stylish'))
        .pipe(gulpif(enabled.failJSHint, jshint.reporter('fail')));
});

// gulp tslint
// lints project TS
// if --production flag is set errors fails task
gulp.task('tslint', function() {
    return gulp.src(project.typescript)
        .pipe(tslint())
        .pipe(tslint.report("prose", { emitError: enabled.failTSLint && true || false }));
});

// gulp fonts
// fonts to flat directory
gulp.task('fonts', function() {
    return gulp.src(globs.fonts)
        .pipe(flatten())
        .pipe(gulp.dest(path.dist + path.fonts))
        .pipe(browserSync.stream());
});

// gulp html
// minify and copy html to destination
gulp.task('html', function() {
    var manifest = gulp.src(revManifest);

    return gulp.src(project.html)
        .pipe(gulpif(enabled.minimize, minifyHtml({
            caseSensitive: true,
            collapseInlineTagWhitespace: true,
            collapseWhitespace: true,
            minifyCSS: true,
            minifyJS: true,
            removeComments: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            useShortDoctype: true
        })))
        .pipe(gulpif(enabled.rev, revReplace({ manifest: manifest })))
        .pipe(gulp.dest(path.dist))
        .pipe(browserSync.stream());
});

// gulp assets
// lossless compression of images and copy assets folder
gulp.task('assets', function() {
    return gulp.src(project.assets)
        .pipe(gulpif(enabled.minimize, imagemin({
            progressive: true,
            interlaced: true,
            svgoPlugins: [{ removeUnknownsAndDefaults: false }, { cleanupIDs: false }]
        })))
        .pipe(gulp.dest(path.dist + path.assets))
        .pipe(browserSync.stream());
});

// gulp typings
// install typescript definitions
gulp.task('typings', function(done) {
    return gulp.src('./typings.json')
        .pipe(typings());
});

// gulp clean
// delete build and dist folders
gulp.task('clean', require('del').bind(null, [path.dist, path.build]));

// gulp watch
// watch files and initiate tasks accordingly
gulp.task('watch', function() {
    // browserSync.init({
    //     proxy: config.devUrl
    // });
    gulp.watch([
        path.source + '/**/*.css',
        path.source + '/**/*.scss',
        path.source + '/**/*.less'
    ], ['styles']);
    gulp.watch([path.source + '**/*.ts', path.source + '**/*.js'], ['scripts']);
    gulp.watch([path.source + path.assets + '**/*'], ['assets']);
    gulp.watch([path.source + '**/*.html'], ['html']);
    gulp.watch(['bower.json', 'manifest.json', 'typings.json'], ['build']);
});

// gulp build
// build without clean
gulp.task('build', function(callback) {
    runSequence('typings', 'styles',
        'scripts',
        ['fonts', 'html', 'assets'],
        callback);
});

// gulp
// clean and build
gulp.task('default', ['clean'], function() {
    gulp.start('build');
});
