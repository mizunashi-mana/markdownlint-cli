var path = require('path');
var glob = require('glob');
var isValidGlob = require('is-valid-glob');
var difference = require('lodash.difference');

function globSyncAbs(globfile) {
  return glob.sync(globfile).map(function (file) {
    return path.resolve(file);
  });
}

function resolveGlobs(globs) {
  // Only one glob no need to aggregate
  if (!Array.isArray(globs)) {
    globs = [globs];
  }

  var files = [];

  globs.forEach(function (globfile) {
    if (isNegative(globfile)) {
      files = difference(files, globSyncAbs(globfile.substr(1)));
    } else {
      files = files.concat(globSyncAbs(globfile));
    }
  });

  return files;
}

function isNegative(pattern) {
  return pattern[0] === '!';
}

function beNegative(pattern) {
  return '!' + pattern;
}

module.exports = {
  isValidGlob,
  resolveGlobs,
  globSyncAbs,
  beNegative
};
