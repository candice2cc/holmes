/**
 * Created by candice on 16/8/19.
 */
var fs = require('graceful-fs');
var path = require('path');

var gulp = require('gulp');

// Load all gulp plugins automatically
// and attach them to the `plugins` object
var plugins = require('gulp-load-plugins')();

// Temporary solution until gulp 4
// https://github.com/gulpjs/gulp/issues/355
var runSequence = require('run-sequence');

var pkg = require('./package.json');
var dirs = pkg['h5-configs'].directories;

// ---------------------------------------------------------------------
// | Helper tasks                                                      |
// ---------------------------------------------------------------------

gulp.task('archive:create_archive_dir', function () {
    fs.mkdirSync(path.resolve(dirs.archive), '0755');
});

gulp.task('archive:zip', function (done) {

    var archiveName = path.resolve(dirs.archive, pkg.name + '_v' + pkg.version + '.zip');
    var archiver = require('archiver')('zip');
    var files = require('glob').sync('**/*.*', {
        'cwd': dirs.dist,
        'dot': true // include hidden files
    });
    var output = fs.createWriteStream(archiveName);

    archiver.on('error', function (error) {
        done();
        throw error;
    });

    output.on('close', done);

    files.forEach(function (file) {

        var filePath = path.resolve(dirs.dist, file);

        // `archiver.bulk` does not maintain the file
        // permissions, so we need to add files individually
        archiver.append(fs.createReadStream(filePath), {
            'name': file,
            'mode': fs.statSync(filePath).mode
        });

    });

    archiver.pipe(output);
    archiver.finalize();

});

gulp.task('clean', function (done) {
    require('del')([
        dirs.archive,
        dirs.dist,
        dirs.tmp
    ]).then(function () {
        done();
    });
});

gulp.task('less', function () {
    return gulp.src(dirs.src + '/styles/less/main.less')
        .pipe(plugins.less())
        .pipe(plugins.autoprefixer({
            browsers: ['last 2 versions', 'ie >= 8', '> 1%'],
            cascade: false
        }))
        .pipe(gulp.dest(dirs.tmp + '/css'));
});

gulp.task('copy', [
    'copy:misc',
    'copy:license',
    'copy:images',
    'copy:other'


]);

gulp.task('copy:misc', ['less'], function () {
    var assets = plugins.useref();  //build块的文件搜索路径（searchPath拼接html引用path）
    var jsFilter = plugins.filter("**/*.js", {restore: true});
    var cssFilter = plugins.filter("**/*.css", {restore: true});
    var htmlFilter = plugins.filter('**/*.html', {restore: true});
    var notHtmlFilter = plugins.filter(["**/*","!**/*.html"], {restore: true});//非HTML的文件均使用md5重命名

    return gulp.src(dirs.src + '/*.html')
        .pipe(assets)   //build标签中的path
        .pipe(jsFilter)
        .pipe(plugins.uglify({compress: {drop_console: true}}))
        .pipe(jsFilter.restore)
        .pipe(cssFilter)
        .pipe(plugins.minifyCss())
        .pipe(cssFilter.restore)
        .pipe(htmlFilter)
        .pipe(plugins.minifyHtml({conditionals: true, loose: true}))
        .pipe(htmlFilter.restore)
        .pipe(notHtmlFilter)
        .pipe(plugins.rev())
        .pipe(notHtmlFilter.restore)
        .pipe(plugins.revReplace())
        .pipe(gulp.dest(dirs.dist));
});


gulp.task('copy:license', function () {
    return gulp.src('LICENSE.txt')
        .pipe(gulp.dest(dirs.dist));
});
gulp.task('copy:images', function () {
    return gulp.src(dirs.src + '/images/*')
        .pipe(plugins.imagemin())
        .pipe(gulp.dest(dirs.dist + '/images'));
});

gulp.task('copy:other', function () {
    return gulp.src([

        // Copy all files
        dirs.src + '/**/*',

        // Exclude the following files
        // (other tasks will handle the copying of these files)
        '!' + dirs.src + '/styles/**/*',
        '!' + dirs.src + '/scripts/**/*',
        '!' + dirs.src + '/*.html'

    ], {

        // Include hidden files by default
        dot: true

    }).pipe(gulp.dest(dirs.dist));
});


gulp.task('lint:js', function () {
    return gulp.src([
        'gulpfile.js',
        dirs.src + '/scripts/*.js',
        dirs.test + '/*.js'
    ]).pipe(plugins.jscs())
        .pipe(plugins.jshint())
        .pipe(plugins.jshint.reporter('jshint-stylish'))
        .pipe(plugins.jshint.reporter('fail'));
});


// ---------------------------------------------------------------------
// | Main tasks                                                        |
// ---------------------------------------------------------------------

gulp.task('archive', function (done) {
    runSequence(
        'build',
        'archive:create_archive_dir',
        'archive:zip',
        done);
});

gulp.task('build', function (done) {
    runSequence(
        ['clean', 'lint:js'],
        'copy',
        done);
});

gulp.task('default', ['build']);
