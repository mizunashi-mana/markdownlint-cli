#!/usr/bin/env node

'use strict';

var fs = require('fs');
var path = require('path');
var values = require('lodash.values');
var keys = require('lodash.keys');
var intersection = require('lodash.intersection');
var rc = require('rc');
var Ajv = require('ajv');
var markdownlint = require('markdownlint');
var program = require('commander');
var globUtil = require('./lib/glob-util');
var util = require('./lib/util');
var pkg = require('./package');

function resolveProjFile(file) {
  return path.join(__dirname, file);
}

function readJSONFrom(file) {
  return JSON.parse(fs.readFileSync(file));
}

var validatorConfig = new Ajv({useDefaults: true}).compile(
  readJSONFrom(resolveProjFile('assets/config.schema.json'))
);

function reportAjvError(validator) {
  return validator.errors.map(function (err) {
    return err.dataPath + ': ' + err.message;
  }).join('\n');
}

function readConfigFile(file, isdebug) {
  isdebug = isdebug || false;

  try {
    return readJSONFrom(file);
  } catch (err) {
    console.warn('Cannot read config file', file);
    if (isdebug) {
      console.warn(err.stack || err.message || 'Config File Error');
    }
    return null;
  }
}

function readConfiguration(opts) {
  var config = null;
  var projectConfigFile = '.markdownlint.json';

  // user config
  if (opts.config) {
    config = readConfigFile(opts.config, opts.debug);
    if (!config) {
      return null;
    }
  }

  // project config
  if (!config) {
    try {
      fs.accessSync(projectConfigFile, fs.R_OK);
      config = readConfigFile(projectConfigFile);
    } catch (err) {
    }
  }

  // rc config
  if (!config) {
    config = rc('markdownlint', {}).config;
  }

  if (!config) {
    config = {};
  }

  if (intersection(keys(config), ['rules', 'excludes', 'files']).length === 0) {
    config = {
      rules: config
    };
  }

  if (!validatorConfig(config)) {
    console.warn(
      reportAjvError(validatorConfig)
      .replace(/(^|\n)/g, '  $1')
    );

    return null;
  }

  return config;
}

function resolveFileSpecify(file) {
  if (util.isDirectory(file)) {
    return path.join(file, '**', '*.md');
  }
  return file;
}

function prepareFileList(files, conf, opts) {
  var fexclusion = opts.forceExclusion || false;

  if (files.length + conf.files.length + conf.excludes.length === 0) {
    files = ['.'];
  }
  files = files.map(function (file) {
    return resolveFileSpecify(file);
  });
  var includes = conf.files.map(function (file) {
    return resolveFileSpecify(file);
  });
  var excludes = conf.excludes.map(function (exclude) {
    return globUtil.beNegative(resolveFileSpecify(exclude));
  });

  var globs = fexclusion ?
    includes.concat(files, excludes) :
    includes.concat(excludes, files);

  if (!globUtil.isValidGlob(globs)) {
    console.warn('Invalid glob pattern: ' + globs);
    return null;
  }

  return globUtil.resolveGlobs(globs);
}

function lint(lintFiles, config) {
  var lintOptions = {
    files: lintFiles.map(function (file) {
      return path.relative('.', file);
    }),
    config: config
  };
  return markdownlint.sync(lintOptions);
}

function printResult(lintResult, hasErrors) {
  if (hasErrors) {
    console.error(lintResult.toString());
    process.exit(1);
  } else {
    console.log(lintResult.toString());
  }
}

function hasResultErrors(lintResult) {
  function notEmptyObject(item) {
    return Object.keys(item).length > 0;
  }
  return values(lintResult)
    .some(notEmptyObject)
    ;
}

program
  .version(pkg.version)
  .description(pkg.description)
  .usage('[options] <files>')
  .option('-c, --config [configFile]', 'Configuration file')
  .option('-d, --debug', 'Debug mode')
  .option('--force-exclusion', 'Force exclusion files even if they are explicitly passed as arguments')
  ;

program.parse(process.argv);

var config = readConfiguration(program);
if (!config) {
  process.exit(2);
}

var files = prepareFileList(program.args, config, program);

if (files && files.length > 0) {
  var lintResult = lint(files, config);
  var hasErrors = hasResultErrors(lintResult);
  printResult(lintResult, hasErrors);
} else if (files) {
  process.exit(2);
} else {
  program.help();
}
