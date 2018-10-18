const fs = require('fs');
const path = require('path');
const semver = require('semver');

const name = 'remotedev-server';
const startFlag = '/* ' + name + ' start */';
const endFlag = '/* ' + name + ' end */';
const serverFlags = {
  'react-native': {
    '0.0.1': '    _server(argv, config, resolve, reject);',
    '0.31.0': "  runServer(args, config, () => console.log('\\nReact packager ready.\\n'));",
    '0.44.0-rc.0': '  runServer(args, config, startedCallback, readyCallback);',
    '0.46.0-rc.0': '  runServer(runServerArgs, configT, startedCallback, readyCallback);',
    '0.57.0': '  runServer(args, configT);'
  },
  'react-native-desktop': {
    '0.0.1': '    _server(argv, config, resolve, reject);'
  }
};

function getModuleVersion(modulePath) {
  return JSON.parse(
    fs.readFileSync(
      path.join(modulePath, 'package.json'),
      'utf-8'
    )
  ).version;
}

function getServerFlag(moduleName, version) {
  const flags = serverFlags[moduleName || 'react-native'];
  const versions = Object.keys(flags);
  let flag;

  for (let i = 0; i < versions.length; i++) {
    if (semver.gte(version, versions[i])) {
      flag = flags[versions[i]];
    }
  }

  return flag;
}

exports.dir = 'local-cli/server';
exports.file = 'server.js';
exports.fullPath = path.join(exports.dir, exports.file);

exports.inject = function(modulePath, options, moduleName) {
  const filePath = path.join(modulePath, exports.fullPath);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  const serverFlag = getServerFlag(
    moduleName,
    getModuleVersion(modulePath)
  );

  const code = [
    startFlag,
    '    require("' + name + '")(' + JSON.stringify(options) + ')',
    '      .then(_remotedev =>',
    '        _remotedev.on("ready", () => {',
    '          if (!_remotedev.portAlreadyUsed) console.log("-".repeat(80));',
    '      ' + serverFlag,
    '        })',
    '      );',
    endFlag,
  ].join('\n');

  const serverCode = fs.readFileSync(filePath, 'utf-8');
  const alreadyInjectedCheck = serverCode.indexOf(startFlag) === -1;

  const start = alreadyInjectedCheck ? serverCode.indexOf(serverFlag) : serverCode.indexOf(startFlag);  // already injected ?
  const end = alreadyInjectedCheck ? start + serverFlag.length : serverCode.indexOf(endFlag) + endFlag.length;

  fs.writeFileSync(
    filePath,
    serverCode.substr(0, start) + code + serverCode.substr(end, serverCode.length)
  );

  return true;
};

exports.revert = function(modulePath, moduleName) {
  const filePath = path.join(modulePath, exports.fullPath);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  const serverFlag = getServerFlag(
    moduleName,
    getModuleVersion(modulePath)
  );

  const serverCode = fs.readFileSync(filePath, 'utf-8');
  const start = serverCode.indexOf(startFlag); // already injected ?
  const end = serverCode.indexOf(endFlag) + endFlag.length;

  if (start !== -1) {
    fs.writeFileSync(
      filePath,
      serverCode.substr(0, start) + serverFlag + serverCode.substr(end, serverCode.length)
    );
  }

  return true;
};
