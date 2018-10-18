const SCWorker = require('socketcluster/scworker');
const fs = require('fs');
const express = require('express');
const serveStatic = require('serve-static');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const graphiqlMiddleware = require('./middleware/graphiql');
const graphqlMiddleware = require('./middleware/graphql');
const createStore = require('./store');
const healthChecker = require('sc-framework-health-check');

class Worker extends SCWorker {
  run() {
    console.log('   >> Worker PID:', process.pid);

    const app = express();

    const httpServer = this.httpServer;
    const scServer = this.scServer;
    const store = createStore(this.options);

    const environment = this.options.environment;
    const port = this.options.port;
    const limit = this.options.maxRequestBody;
    const logHTTPRequests = this.options.logHTTPRequests;

    if (environment === 'dev') {
      // Log every HTTP request. See https://github.com/expressjs/morgan for other
      // available formats.
      app.use(morgan('dev'));
    }
    app.use(serveStatic(path.resolve(__dirname, 'public')));

    // Add GET /health-check express route
    healthChecker.attach(this, app);

    httpServer.on('request', app);

    app.set('view engine', 'ejs');
    app.set('views', path.resolve(__dirname, '..', 'views'));

    if (logHTTPRequests) {
      if (typeof logHTTPRequests === 'object') {
        app.use(morgan('combined', logHTTPRequests));
      } else {
        app.use(morgan('combined'));
      }
    }

    app.use('/graphiql', graphiqlMiddleware);

    app.get('*', function(req, res) {
      res.render('index', { port });
    });

    app.use(cors({ methods: 'POST' }));
    app.use(bodyParser.json({ limit: limit }));
    app.use(bodyParser.urlencoded({ limit: limit, extended: false }));

    app.use('/graphql', graphqlMiddleware(store));

    app.post('/', function(req, res) {
      if (!req.body) {
        return res.status(404).end();
      }

      switch(req.body.op) {
        case 'get':
          store
            .get(req.body.id)
            .then(function(r) {
              res.send(r || {});
            })
            .catch(function(error) {
              console.error(error);
              res.sendStatus(500)
            });
          break;

        case 'list':
          store
            .list(req.body.query, req.body.fields)
            .then(function(r) {
              res.send(r);
            })
            .catch(function(error) {
              console.error(error);
              res.sendStatus(500)
            });
          break;

        default:
          store
            .add(req.body)
            .then(function(r) {
              res.send({ id: r.id, error: r.error });
              scServer.exchange.publish('report', {
                type: 'add', data: r
              });
            })
            .catch(function(error) {
              console.error(error);
              res.status(500).send({})
            });

      }

    });

    scServer.addMiddleware(scServer.MIDDLEWARE_EMIT, function(req, next) {
      const channel = req.event;
      const data = req.data;

      if (channel.substr(0, 3) === 'sc-' || channel === 'respond' || channel === 'log') {
        scServer.exchange.publish(channel, data);
      } else if (channel === 'log-noid') {
        scServer.exchange.publish('log', { id: req.socket.id, data: data });
      }

      next();
    });

    scServer.addMiddleware(scServer.MIDDLEWARE_SUBSCRIBE, function(req, next) {
      next();

      if (req.channel === 'report') {
        store.list().then(function(data) {
          req.socket.emit(req.channel, { type: 'list', data: data });
        }).catch(function(error) {
          console.error(error);
        });
      }
    });

    /*
      In here we handle our incoming realtime connections and listen for events.
    */
    scServer.on('connection', function (socket) {

      // Some sample logic to show how to handle client events,
      // replace this with your own logic

      // socket.on('sampleClientEvent', function (data) {
      //   count++;
      //   console.log('Handled sampleClientEvent', data);
      //   scServer.exchange.publish('sample', count);
      // });

      let channelToWatch;
      let channelToEmit;

      // console.log('connection', socket);

      socket.on('login', function(credentials, respond) {
        if (credentials === 'master') {
          channelToWatch = 'respond';
          channelToEmit = 'log';
        } else {
          channelToWatch = 'log';
          channelToEmit = 'respond';
        }

        scServer.exchange.subscribe('sc-' + socket.id).watch(function(msg) {
          socket.emit(channelToWatch, msg);
        });

        respond(null, channelToWatch);
      });

      socket.on('getReport', function(id, respond) {
        store.get(id).then(function(data) {
          respond(null, data);
        }).catch(function(error) {
          console.error(error);
        });
      });

      socket.on('disconnect', function() {
        const channel = scServer.exchange.channel('sc-' + socket.id);

        channel.unsubscribe();
        channel.destroy();
        scServer.exchange.publish(
          channelToEmit,
          { id: socket.id, type: 'DISCONNECTED' }
        );
      });

      // var interval = setInterval(function () {
      //   socket.emit('rand', {
      //     rand: Math.floor(Math.random() * 5)
      //   });
      // }, 1000);
      //
      // socket.on('disconnect', function () {
      //   clearInterval(interval);
      // });

    });
  }
}

new Worker();
