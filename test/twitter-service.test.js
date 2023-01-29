/* jshint expr: true */ // for to.be.empty
import chai from 'chai';
const should = chai.should;
const expect = chai.expect;

import log4js from 'log4js';
import { ContainerBuilder } from 'node-dependency-injection';
import ApplicationConfig from '../src/config/ApplicationConfig.js';
const appConfig = ApplicationConfig.getInstance();

const logger = log4js.getLogger('twitter-service.test');
logger.level = "DEBUG"; // DEBUG will show api params

var service;
var lastTweet;

describe("TwitterV2Service", function() {

  before(async function () {
    logger.debug("TwitterV2Service :: before");
    service = appConfig.get('twitterV2Service');
  });

  it("get tweet details", async function() {

    const tweetInfo = await service.getTweetDetails("1617182960553271297").catch(_expectNoError);
    logger.debug("found tweet of", tweetInfo.user.name);

    expect(tweetInfo.user.name).to.equal("boly38");
    expect(tweetInfo.quoted_status.full_text).to.contains("heure de vérité");

  });

  it("get user timeline", async function() {

    const extendedMode = true;
    const username = "boly38";
    const count = 2;

    logger.debug(`userTimeline(${username}, ${count})`);
    const v2Timeline = await service.userTimeline(username, count).catch(_expectNoError);
    expect(v2Timeline.length).to.be.eql(count);
    expect(v2Timeline[0].full_text).to.not.be.empty;
    expect(v2Timeline[1].full_text).to.not.be.empty;
    // logger.debug("v2Timeline", JSON.stringify(v2Timeline, null, 2));

  });

  it("search tweets", async function() {
    const searchCount = 2;
    const noRetweet = " -filter:retweets";
    const fromMe = " from:botEnTrain1";
    const extendedMode = true;
    const searchQuery = "\"l'or\"" + noRetweet + fromMe;

    logger.debug("searchQuery", searchQuery);

    const searchResult = await service.searchV1(searchQuery,  !extendedMode, searchCount).catch(_expectNoError);
    // logger.debug("searchV1", searchResult);
    let mentioned = [];
    searchResult.forEach(t => {
        if (t.entities && t.entities.user_mentions) {
          t.entities.user_mentions.forEach((mention) => {
              mentioned.push(mention.screen_name);
          });
          lastTweet = t;
        }
    });
    logger.debug("mentioned", mentioned);
    expect(mentioned.length).to.be.gte(1);

  });

  // no automated test for "replyTo"

  it("get recently mentioned users", async function() {
    const userName = "botentrain1";
    const count = 2;
    logger.debug("recently mentioned users...");
    const mentioned = await service.getRecentlyMentionedUsers(userName, count).catch(_expectNoError);
    logger.debug("recently mentioned users" + mentioned);
  });

  it("get recently answered status", async function() {
    const userName = "botentrain1";
    const count = 2;
    const statusesIds = await service.getRecentlyAnsweredStatuses(userName, count).catch(_expectNoError);
    logger.debug("recently answered status", statusesIds);
  });

  it("get tweet link of", function() {
    const id_str = 1233321;
    const screen_name = 'jojo';
    const link = service.tweetLinkOf({id_str, user: {screen_name}});

    expect(link).to.equal(`https://twitter.com/${screen_name}/status/${id_str}`);
  });

  it("get tweet info of", function() {
    const tweetInfo = service.tweetInfoOf(lastTweet);

    logger.debug("tweet info of lastTweet", tweetInfo);
    expect(tweetInfo).to.contains("--- @botEnTrain1: ");
  });

  it("get tweet html of", function() {
    const tweetHtml = service.tweetHtmlOf(lastTweet);

    logger.debug("tweet html of lastTweet", tweetHtml);
    expect(tweetHtml).to.contains("</a> --- <a href=\"https://twitter.com/botEnTrain1\">@botEnTrain1</a>: ");
  });

  it("get tweet text of", function() {
    const tweetText = service.tweetTextOf(lastTweet);

    logger.debug("tweet text of lastTweet", tweetText);
    expect(tweetText).not.to.be.empty;
  });

  // tweetFirstMediaUrl no tested

  it("get tweet user mentions name of", function() {
    const tweetMentions = service.tweetUserMentionsNames(lastTweet);

    logger.debug("tweet mentions of lastTweet", tweetMentions);
    expect(tweetMentions).not.to.be.empty;
  });

});

function _expectNoError(err) {
  logger.error("_expectNoError", err);
  console.trace();// print stack
  // var stack = new Error().stack
  // console.log( stack )
  expect.fail(err);
}
