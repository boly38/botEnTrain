/* jshint expr: true */ // for to.be.empty
import chai from 'chai';
const should = chai.should;
const expect = chai.expect;

import log4js from 'log4js';
import { ContainerBuilder } from 'node-dependency-injection';
import ApplicationConfig from '../src/config/ApplicationConfig.js';
const appConfig = ApplicationConfig.getInstance();

const logger = log4js.getLogger('twitter-service.test');
logger.level = "INFO"; // DEBUG will show api params

import { TwitterV2IncludesHelper } from 'twitter-api-v2'; // https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/helpers.md


const boly38id = '11168212';
const botentrain1id = '1254020717710053376';

var service;
var lastTweet = null;
var lastUsers = null;

// v2 tests example : https://github.com/PLhery/node-twitter-api-v2/blob/master/test/tweet.v2.test.ts

describe("TwitterAPIV2Service", function() {

  before(async () => {
    logger.debug("TwitterAPIV2Service :: before");
    service = appConfig.get('twitterAPIV2Service');
  });

  it("get tweet details", async () => {

    const tweet = await service.getSingleTweet("1617182960553271297").catch(_expectNoError);
    // logger.debug("getSingleTweet",tweet);

    const tweetAuthorId = tweet?.data?.author_id; // 'author_id'
    const tweetAuthorName = tweetAuthorId ? tweet.includes.users.find(t => t.id === tweetAuthorId).name : undefined; // 'entities.mentions.username',

    expect(tweetAuthorName).to.equal("boly38");

    const includes = new TwitterV2IncludesHelper(tweet);

    const quotedTweetId = tweet?.data?.referenced_tweets?.find(t => t.type === "quoted")?.id;
    logger.debug("quotedTweetId",quotedTweetId);

    if (quotedTweetId) {
      const quotedTweet = includes.tweetById(quotedTweetId);
      logger.debug("quotedTweet",quotedTweet);
      expect(quotedTweet.text).to.contains("heure de vérité");
    } else {
      logger.warn("no quotedTweet ?");
    }

  }).timeout(60 * 1000);

  it("get user timeline", async () => {

    const extendedMode = true;
    const username = "boly38";
    var max_results = 2;

    const v2TimelineErr = await service.userTimeline(username, max_results).catch(err =>  {
      logger.debug(err);
    });

    max_results = 5;
    const userId = boly38id;
    // const userId = botentrain1id;
    const {tweets, users, rateLimit} = await service.userTimeline(userId, 5).catch(err => logger.error(err));

    logger.debug("v2Timeline", JSON.stringify(tweets, null, 2));
    expect(tweets.length).to.be.eql(max_results);
    expect(tweets[0].text).to.not.be.empty;
    expect(tweets[1].text).to.not.be.empty;

  }).timeout(60 * 1000);

  it("search in recent (now-7d) tweets", async () => {
    const searchCount = 10;
    const noRetweet = " (-is:retweet)"; // v1: " -filter:retweets";
    const fromMe = " (from:botEnTrain1)"; // v1: " from:botEnTrain1";
    const containingTxt = "\"cons\"";

    const searchQuery = containingTxt + fromMe + noRetweet;

    logger.debug("searchQuery", searchQuery);

    const {tweets, users, rateLimit} = await service.searchRecent(searchQuery, searchCount).catch(_expectNoError);
    logger.debug("searchRecent", JSON.stringify({tweets, users, rateLimit}, null, 2));

    lastUsers = users;
    var mentioned = [];
    tweets?.forEach(t => {
      t.entities?.mentions?.forEach( mention  => { mentioned.push(mention?.username); });
      lastTweet = t;
    });

    if (tweets && tweets.length > 0) {
      tweets[0] && logger.debug("tweet", service.tweetLinkOf(tweets[0], users));
      logger.debug("mentioned", mentioned);
      expect(mentioned.length).to.be.gte(1);
    }

  }).timeout(60 * 1000);

  // no automated test for "replyTo"

  it("get recently mentioned users", async () => {
    // const userId = boly38id;
    const userId = botentrain1id;
    const count = 10;
    logger.debug("recently mentioned users...");
    const mentioned = await service.getRecentlyMentionedUsers(userId, count).catch(_expectNoError);
    logger.debug("recently mentioned users" + mentioned);
  }).timeout(60 * 1000);


  it("get recently answered status", async () => {
    const userId = botentrain1id;
    const count = 10;
    const statusesIds = await service.getRecentlyAnsweredStatuses(userId, count).catch(_expectNoError);
    logger.debug("recently answered status", statusesIds);
  }).timeout(60 * 1000);

if (lastTweet) {

  it("get tweet link of", () => {
    const users = lastUsers;
    const tweet = lastTweet;
    const link = service.tweetLinkOf(tweet, users)

    logger.debug("tweet link of lastTweet", link);
    expect(link).to.contains("https://twitter.com/");
  }).timeout(60 * 1000);

  it("get tweet info of", () => {
    const users = lastUsers;
    const tweet = lastTweet;
    const tweetInfo = service.tweetInfoOf(tweet, users);

    logger.debug("tweet info of lastTweet", tweetInfo);
    expect(tweetInfo).to.contains("--- @botEnTrain1: ");
  }).timeout(60 * 1000);

  it("get tweet html of", () => {
    const users = lastUsers;
    const tweet = lastTweet;
    const tweetHtml = service.tweetHtmlOf(tweet, users);

    logger.debug("tweet html of lastTweet", tweetHtml);
    expect(tweetHtml).to.contains("</a> --- <a href=\"https://twitter.com/botEnTrain1\">@botEnTrain1</a>: ");
  }).timeout(60 * 1000);

  // tweetFirstMediaUrl no tested

  it("get tweet user mentions name of", () => {
    const tweetMentions = service.tweetUserMentionsNames(lastTweet);

    logger.debug("tweet mentions of lastTweet", tweetMentions);
    expect(tweetMentions).not.to.be.empty;
  }).timeout(60 * 1000);

} else {

  logger.info("skipped some test without recent tweet");

}


});

const _expectNoError = (err) => {
  logger.error("_expectNoError", err);
  console.trace();// print stack
  // var stack = new Error().stack
  // console.log( stack )
  expect.fail(err);
}
