const serverless = require('serverless-http');

const { app, seedData } = require('../../src/server');

let cachedHandler = null;

exports.handler = async (event, context) => {
  await seedData();

  if (!cachedHandler) {
    cachedHandler = serverless(app);
  }

  return cachedHandler(event, context);
};
