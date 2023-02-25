/* jshint expr: true */ // for to.be.empty
import chai from 'chai';
const should = chai.should;
const expect = chai.expect;

import log4js from 'log4js';
import { ContainerBuilder } from 'node-dependency-injection';
import ApplicationConfig from '../src/config/ApplicationConfig.js';
const appConfig = ApplicationConfig.getInstance();

const logger = log4js.getLogger('dialogBTP.test');
logger.level = "INFO"; // DEBUG will show api params

// unused // import { TwitterV2IncludesHelper } from 'twitter-api-v2'; // https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/helpers.md

const boly38id = '11168212';
const botentrain1id = '1254020717710053376';

const pluginConfig = {doSimulate: true};
var plugin;

// v2 tests example : https://github.com/PLhery/node-twitter-api-v2/blob/master/test/tweet.v2.test.ts

describe("dialogBTP", function() {

  before(async () => {
    logger.debug("dialogBTP test :: before");
    plugin = appConfig.get('dialogBTP');
  });

  it("simulate dialog btp", async () => {

    const result = await plugin.process(pluginConfig).catch( err => {
      if (err.status === 202) {
        logger.debug("plugin.process : no result");
      } else {
        _expectNoError(err);
      }
    });

    if (result) {
      logger.debug("plugin.process",result);
      expect(result.html).not.to.be.empty;
      expect(result.text).not.to.be.empty;
      expect(result.text).to.contains(" --- @botEnTrain1: SIMULATION - @");
    }

  }).timeout(60 * 1000);

});

const _expectNoError = (err) => {
  logger.error("_expectNoError", err);
  console.trace();// print stack
  // var stack = new Error().stack
  // console.log( stack )
  expect.fail(err);
}
