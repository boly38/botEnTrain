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
var createdTweet = null;
var replyTweet = null;
var testCreatedTweetIds = [];

const testPlan = {
  getSingleTweet: true,
  getTweet: true,
  userTimeline: true,
  searchRecent: true,
  getRecentlyMentionedUsers: true,
  getRecentlyAnsweredStatuses: true,
  writeTweet: false
}

// v2 tests example : https://github.com/PLhery/node-twitter-api-v2/blob/master/test/tweet.v2.test.ts

describe("TwitterAPIV2Service", function() {

  before(async () => {
    logger.debug("TwitterAPIV2Service :: before");
    service = appConfig.get('twitterAPIV2Service');
  });

  after(async function () {
    console.info("TwitterAPIV2Service :: after");
    testCreatedTweetIds.forEach( tweetId => {
         service.deleteTweet(tweetId).catch(err => { console.error("unable to delete tweet id:", tweetId, " err:", err)})
       });
  });

if (testPlan.getSingleTweet) {

  it("get single tweet", async () => {

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

}

if (testPlan.getTweet) {

  it("get tweet", async () => {

    // https://twitter.com/TelaBotanica/status/1317431664784662528
    // "conversation_id": "1317431664784662528",
    const {tweets, users, medias, tweet} = await service.getTweet("1317431664784662528").catch(_expectNoError);
    // logger.debug("getTweet",JSON.stringify(tweet));

    const tweetAuthorId = tweet?.author_id; // 'author_id'
    const tweetAuthor = tweetAuthorId ? users.find(t => t.id === tweetAuthorId)  : undefined;
    const tweetAuthorName = tweetAuthor ? tweetAuthor.name : undefined;
    const tweetAuthorUsername = tweetAuthor ? tweetAuthor.username : undefined;

    expect(tweetAuthorName).to.equal("Tela Botanica");
    expect(tweetAuthorUsername).to.equal("TelaBotanica");

    const mediaUrl = medias?.find(t => t.type === "photo")?.url;
    logger.debug("mediaUrl",mediaUrl);

    if (mediaUrl) {
      expect(mediaUrl).to.contains(".jpg");
    }
    expect(tweet.public_metrics.retweet_count).to.be.gte(4);
    expect(tweet.public_metrics.reply_count).to.be.gte(9);
    expect(tweet.public_metrics.like_count).to.be.gte(20);
    // expect(tweet.conversation_id).to.equal("1317431664784662528");

  }).timeout(60 * 1000);

}

if (testPlan.userTimeline) {

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

}

if (testPlan.searchRecent) {

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

}

if (testPlan.getRecentlyMentionedUsers) {

  // no automated test for "replyTo"

  it("get recently mentioned users", async () => {
    // const userId = boly38id;
    const userId = botentrain1id;
    const count = 10;
    logger.debug("recently mentioned users...");
    const mentioned = await service.getRecentlyMentionedUsers(userId, count).catch(_expectNoError);
    logger.debug("recently mentioned users" + mentioned);
  }).timeout(60 * 1000);

}

if (testPlan.getRecentlyAnsweredStatuses) {

  it("get recently answered status", async () => {
    const userId = botentrain1id;
    const count = 10;
    const statusesIds = await service.getRecentlyAnsweredStatuses(userId, count).catch(_expectNoError);
    logger.debug("recently answered status", statusesIds);
  }).timeout(60 * 1000);

}

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

// writeTweet need ApiKey with READ+WRITE SCOPE
if (testPlan.writeTweet) { // created tweets will be deleted by after() !

  it("tweet", async () => {
    const message = "this is for #testPurpose";
    logger.debug("create tweet message:", message);
    createdTweet = await service.tweet(message).catch(_expectNoError);
    logger.debug("createdTweet", createdTweet);

    testCreatedTweetIds.push(createdTweet.id);

    await sleepMs(10000);

  }).timeout(60 * 1000);

  if (createdTweet !== undefined) {

    it("reply to a tweet", async () => {
      const message = "this is a reply for #testPurpose";
      logger.debug("create reply tweet message:", message);
      replyTweet = await service.reply(createdTweet.id, message).catch(_expectNoError);
      logger.debug("replyTweet", replyTweet);

      testCreatedTweetIds.push(replyTweet.id);

      await sleepMs(20000);

    }).timeout(60 * 1000);

    if (createdTweet !== undefined) {

      it("reply and quote a tweet", async () => {
        const message = "this is a reply+quote for #testPurpose";
        logger.debug("create reply+quote tweet message:", message);
        const replyQTweet = await service.replyAndQuote(replyTweet.id, createdTweet.id, message).catch(_expectNoError);
        logger.debug("reply+quoteTweet", replyQTweet);

        testCreatedTweetIds.push(replyQTweet.id);

        await sleepMs(20000);

      }).timeout(60 * 1000);

    }

  }

}

});

const _expectNoError = (err) => {
  logger.error("_expectNoError", err);
  console.trace();// print stack
  // var stack = new Error().stack
  // console.log( stack )
  expect.fail(err);
}

const sleepMs = ms => new Promise(resolve => setTimeout(resolve, ms));