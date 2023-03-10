/* jshint expr: true */ // for to.be.empty
import chai from 'chai';
const should = chai.should;
const expect = chai.expect;

import log4js from 'log4js';
import { ContainerBuilder } from 'node-dependency-injection';
import ApplicationConfig from '../src/config/ApplicationConfig.js';
const appConfig = ApplicationConfig.getInstance();

const logger = log4js.getLogger('yesMasterBTP.test');
logger.level = "DEBUG"; // DEBUG will show api params


const boly38id = '11168212';
const botentrain1id = '1254020717710053376';
const notAnsweredTweet = "https://twitter.com/VillaNg2/status/1525582137382019072";
const alreadyAnsweredTweet = "https://twitter.com/TelaBotanica/status/1317431664784662528";

const pluginConfig = {doSimulate: true};
var plugin;

describe("yesMasterBTP", function() {

  before(async () => {
    logger.debug("yesMasterBTP test :: before");
    plugin = appConfig.get('yesMasterBTP');
  });

  it("simulate yesMaster btp", async () => {

    pluginConfig.tweet = alreadyAnsweredTweet;

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
      expect(result.text).to.contains(" --- @botEnTrain1: SIMULATION -");
    }

  }).timeout(60 * 1000);

});

const _expectNoError = (err) => {
  logger.error("_expectNoError", err);
  console.trace();// print stack
  // var stack = new Error().stack
  // console.log( stack )
  expect.fail(mixedErrorToString(err));
}

const mixedErrorToString = (error) => {
  if (error === undefined || error === null) {
    return error;
  }
  return Object.keys(error).length > 0 ? JSON.stringify(error) : error;
}
