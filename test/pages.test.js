/* jshint expr: true */ // for to.be.empty
import chai from 'chai';
import chaiHttp from 'chai-http';
const should = chai.should;
const expect = chai.expect;
should();
chai.use(chaiHttp);

import { ContainerBuilder } from 'node-dependency-injection';
import ApplicationConfig from '../src/config/ApplicationConfig.js';

import log4js from 'log4js';

const logger = log4js.getLogger('twitter-service.test');
logger.level = "INFO"; // DEBUG will show api params

const appConfig = ApplicationConfig.getInstance();

var agent;

describe("Pages", function() {

  before(async function() {
    console.info("route test :: before");

    const expressServer = appConfig.get('expressServer');
    agent = chai.request.agent(expressServer.listeningServer)

  });

  it("get /", (done) => {

      agent
        .get("/")
        .end((err, res) => {
          assumeSuccess(err, res);
          done();
        });

  })

  it("get /aide", (done) => {

      agent
        .get("/aide")
        .end((err, res) => {
          assumeSuccess(err, res);
          done();
        });

  });

});

const assumeSuccess = (err, res) => {
    if (err) {
      expect.fail(err);
    }
    if (res.status && (res.status < 200 || res.status > 299)) {
      console.log("res status:",res.status, "body:",res.body);
    }
    res.status.should.be.within(200, 299, `response status 2xx success expected`);
}

const _expectNoError = (err) => {
  logger.error("_expectNoError", err);
  console.trace();// print stack
  // var stack = new Error().stack
  // console.log( stack )
  expect.fail(err);
}
