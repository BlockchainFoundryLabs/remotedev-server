#! /usr/bin/env node
const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const chalk = require('chalk');
const injectServer = require('./injectServer');
const getOptions = require('./../lib/options');

function readFile(filePath) {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8');
}

if (argv.protocol === 'https') {
  argv.key = argv.key ? readFile(argv.key) : null;
  argv.cert = argv.cert ? readFile(argv.cert) : null;
}

function log(pass, msg) {
  const prefix = pass ? chalk.green.bgBlack('PASS') : chalk.red.bgBlack('FAIL');
  const color = pass ? chalk.blue : chalk.red;
  console.log(prefix, color(msg));
}

function getModuleName(type) {
  switch (type) {
    case 'macos':
      return 'react-native-macos';
    // react-native-macos is renamed from react-native-desktop

    case 'desktop':
      return 'react-native-desktop';

    case 'reactnative':

    default:
      return 'react-native';
  }
}

function getModulePath(moduleName) {
  return path.join(process.cwd(), 'node_modules', moduleName);
}

function getModule(type) {
  let moduleName = getModuleName(type);
  let modulePath = getModulePath(moduleName);

  if (type === 'desktop' && !fs.existsSync(modulePath)) {
    moduleName = getModuleName('macos');
    modulePath = getModulePath(moduleName);
  }

  return {
    name: moduleName,
    path: modulePath
  };
}

if (argv.revert) {
  var module = getModule(argv.revert);
  var pass = injectServer.revert(module.path, module.name);
  var msg = 'Revert injection of RemoteDev server from React Native local server';
  log(pass, msg + (!pass ? ', the file `' + path.join(module.name, injectServer.fullPath) + '` not found.' : '.'));

  process.exit(pass ? 0 : 1);
}

if (argv.injectserver) {
  var options = getOptions(argv);
  var module = getModule(argv.injectserver);
  var pass = injectServer.inject(module.path, options, module.name);
  var msg = 'Inject RemoteDev server into React Native local server';
  log(pass, msg + (pass ? '.' : ', the file `' + path.join(module.name, injectServer.fullPath) + '` not found.'));

  process.exit(pass ? 0 : 1);
}

require('../index')(argv);
