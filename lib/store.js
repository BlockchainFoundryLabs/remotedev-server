const uuidV4 = require('uuid/v4');
const pick = require('lodash/pick');
const connector = require('./db/connector');
const reports = 'remotedev_reports';
// var payloads = 'remotedev_payloads';
let knex;

const baseFields = ['id', 'title', 'added'];

function error(msg) {
  return new Promise(function(resolve, reject) {
    return resolve({ error: msg });
  });
}

function list(query, fields) {
  const r = knex.select(fields || baseFields).from(reports);

  if (query) {
    return r.where(query);
  }

  return r;
}

function listAll(query) {
  const r = knex.select().from(reports);

  if (query) {
    return r.where(query);
  }

  return r;
}

function get(id) {
  if (!id) {
    return error('No id specified.');
  }

  return knex(reports).where('id', id).first();
}

function add(data) {
  if (!data.type || !data.payload) {
    return error('Required parameters aren\'t specified.');
  }

  if (data.type !== 'ACTIONS' && data.type !== 'STATE') {
    return error('Type ' + data.type + ' is not supported yet.');
  }

  const reportId = uuidV4;

  const report = {
    id: reportId,
    type: data.type,
    title: data.title || data.exception && data.exception.message || data.action,
    description: data.description,
    action: data.action,
    payload: data.payload,
    preloadedState: data.preloadedState,
    screenshot: data.screenshot,
    version: data.version,
    userAgent: data.userAgent,
    user: data.user,
    userId: typeof data.user === 'object' ? data.user.id : data.user,
    instanceId: data.instanceId,
    meta: data.meta,
    exception: composeException(data.exception),
    added: new Date().toISOString(),
  };

  // TODO check if the id exists and we have access to link it
  if (data.appId) {
    report.appId = data.appId;
  }
  /*
  var payload = {
    id: uuid.v4(),
    reportId: reportId,
    state: data.payload
  };
  */

  return knex.insert(report).into(reports)
    .then(function (){ return byBaseFields(report); })
}

function byBaseFields(data) {
  return pick(data, baseFields);
}

function createStore(options) {
  knex = connector(options);

  return {
    list: list,
    listAll: listAll,
    get: get,
    add: add
  };
}

function composeException(exception) {
  let message = '';

  if (exception) {
    message = 'Exception thrown: ';
    if (exception.message)
      message += exception.message;
    if (exception.stack)
      message += '\n' + exception.stack;
  }
  return message;
}

module.exports = createStore;
