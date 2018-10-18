const graphqlExpress = require('graphql-server-express').graphqlExpress;
const schema = require('../api/schema');

module.exports = function (store) {
  return graphqlExpress(function() {
    return {
      schema: schema,
      context: {
        store: store
      }
    };
  });
};
