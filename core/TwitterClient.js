/*jshint esversion: 6 */
const Twit = require('twit');
var log4js = require('log4js');

const TWITTER_POST_ACTION = false;

class TwitterClient {
  constructor() {
    this.logger = log4js.getLogger();
    this.logger.setLevel('INFO'); // DEBUG will show api params
    if (!process.env.APPLICATION_CONSUMER_KEY_HERE ||
    !process.env.APPLICATION_CONSUMER_SECRET_HERE ||
    !process.env.ACCESS_TOKEN_HERE ||
    !process.env.ACCESS_TOKEN_SECRET_HERE
    ) {
        throw "TwitterClient, please setup your environment";
    }
    this.twit = new Twit({
      consumer_key: process.env.APPLICATION_CONSUMER_KEY_HERE,
      consumer_secret: process.env.APPLICATION_CONSUMER_SECRET_HERE,
      access_token: process.env.ACCESS_TOKEN_HERE,
      access_token_secret: process.env.ACCESS_TOKEN_SECRET_HERE,
      timeout_ms:           6*1000,  // optional HTTP request timeout to apply to all requests.
      strictSSL:            true,
    });
  }

  search(searchQuery, searchCount, cb) {
      // Search parameters
      let params = {
        q: "\"" + searchQuery + "\"",
        count: searchCount,
        result_type: 'recent',
        lang: 'fr'
      };

      this.twit.get('search/tweets', params, (err, data, response) => {
        if(!err){
          let tweets = data.statuses;
          this.logDebug("GET search/tweets:" + JSON.stringify(params) + " - result count:" + tweets.length);
          cb(false, tweets);
        } else {
          this.logError("GET search/tweets:" + params + " - err:" + err);
          cb(err);
        }
      });
  }

  replyTo(tweet, replyMsg, cb) {
      let replyStatus = '@' + tweet.user.screen_name + ' - ' + replyMsg;
      let params = {
        in_reply_to_status_id: tweet.id_str,
        status: replyStatus
      };

      this.logDebug("Uses params to reply to : " + JSON.stringify(params));
      this.logInfo("Plan to reply to => " + this.tweetLinkOf(tweet));
      this.logInfo(" " + this.tweetInfoOf(tweet));

      if (!TWITTER_POST_ACTION) {
          cb(false, {
            "id":1234,
            "id_str":1234,
            "text":replyStatus,
            "created_at":"(THIS WAS A SIMULATED REPLY)",
            "user": {
                "id": 1254020717710053400,
                "id_str": '1254020717710053376',
                "name": 'botEnTrain1',
                "screen_name": 'botEnTrain1'
            }
          });
          return;
      }
      this.twit.post('statuses/update', params, (err, data, res) => {
        if(!err){
          this.logInfo("POST statuses/update "+ JSON.stringify(params) + " - result" + data);
          cb(false, data);
        } else {
          logError("POST statuses/update:" + JSON.stringify(params) + " - err:" + err);
          cb(err);
        }
      });
  }

  tweetLinkOf(tweet) {
    if (!tweet) {
      return "";
    }
    let username = tweet.user.screen_name;
    let tweetId = tweet.id_str;
    return `https://twitter.com/${username}/status/${tweetId}`;
  }
  tweetInfoOf(tweet) {
    if (!tweet) {
      return "";
    }
    let username = tweet.user.screen_name;
    let tweetText = tweet.text;
    let tweetDate = tweet.created_at;
    return `@${username} : ${tweetText} --- ${tweetDate}`;
  }

  logError(msg) {
    this.logger.error("TwitterClient | " + msg);
  }
  logInfo(msg) {
    this.logger.info("TwitterClient | " + msg);
  }
  logDebug(msg) {
    this.logger.debug("TwitterClient | " + msg);
  }
}

module.exports = TwitterClient;