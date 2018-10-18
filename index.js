const getPort = require('getport');
const getOptions = require('./lib/options');

const LOG_LEVEL_NONE = 0;
const LOG_LEVEL_ERROR = 1;
const LOG_LEVEL_WARN = 2;
const LOG_LEVEL_INFO = 3;

module.exports = function(argv) {
  const SocketCluster = require('socketcluster');

  const options = Object.assign(getOptions(argv), {
    workerController: __dirname + '/lib/worker.js',
    allowClientPublish: false,
  });
  const port = options.port;
  const logLevel = options.logLevel === undefined ? LOG_LEVEL_INFO : options.logLevel;

  return new Promise(function(resolve) {
    // Check port already used
    getPort(port, function(err, p) {
      if (err) {
        if (logLevel >= LOG_LEVEL_ERROR) {
          console.error(err);
        }
        return;
      }

      if (port !== p) {
        if (logLevel >= LOG_LEVEL_WARN) {
          console.log('[RemoteDev] Server port ' + port + ' is already used.');
        }
        resolve({
          portAlreadyUsed: true, on: function(status, cb) {
            cb();
          }
        });
      } else {
        if (logLevel >= LOG_LEVEL_INFO) {
          console.log('[RemoteDev] Start server...');
          console.log('-'.repeat(80) + '\n');
        }
        resolve(new SocketCluster(options));
      }

    });
  });
};
