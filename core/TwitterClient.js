/*jshint esversion: 6 */
const dateFormat = require('dateformat');
const Twit = require('twit');
var log4js = require('log4js');

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

  // https://developer.twitter.com/en/docs/tweets/post-and-engage/overview
  //   GET statuses/show/:id
  //   https://developer.twitter.com/en/docs/tweets/post-and-engage/api-reference/get-statuses-show-id
  getTweetDetails(tweetId) {
      let params = {
        "id": tweetId,
        "tweet_mode":"extended"
      };
        // useless "include_entities": true,
      this.twit.get('statuses/show', params, (err, data, response) => {
        if(!err){
          this.logDebug("GET statuses/show:" + JSON.stringify(params) + " - result:" +
            JSON.stringify(data));
          // cb(false, tweets);
        } else {
          this.logError("GET statuses/show:" + params + " - err:" + err);
          // cb(err);
        }
      });
  }

  search(searchQuery, searchCount, extendedMode, cb) {
      // Search parameters
      // doc: https://developer.twitter.com/en/docs/tweets/rules-and-filtering/overview/standard-operators
      let params = {
        q: searchQuery,
        count: searchCount,
        result_type: 'recent',
        lang: 'fr'
      };
      if (extendedMode) {
        params.tweet_mode = "extended";
      }

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

  replyTo(tweet, replyMsg, doSimulate, cb) {
      let replyStatus = '@' + tweet.user.screen_name + ' - ' + replyMsg;
      let params = {
        in_reply_to_status_id: tweet.id_str,
        status: replyStatus
      };

      this.logDebug("Uses params to reply to : " + JSON.stringify(params));
      this.logInfo("Plan to reply to => " + this.tweetLinkOf(tweet));
      this.logInfo(" " + this.tweetInfoOf(tweet));

      if (doSimulate) {
          cb(false, {
            "id":1234,
            "id_str":1234,
            "text": "SIMULATION - "+replyStatus,
            "created_at": (new Date()).toUTCString(),
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
          this.logError("POST statuses/update:" + JSON.stringify(params) + " - err:" + err);
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
    let tweetText = this.tweetTextOf(tweet);
    let tweetDate = this.toLocaleDate(tweet.created_at);
    return `${tweetDate} --- @${username}: ${tweetText}`;
  }

  tweetHtmlOf(tweet) {
    if (!tweet) {
      return "";
    }
    let username = tweet.user.screen_name;
    let tweetText = this.tweetTextOf(tweet);
    let tweetDate = this.toLocaleDate(tweet.created_at);
    let tweetId = tweet.id_str;
    return `<a href="https://twitter.com/${username}/status/${tweetId}">${tweetDate}</a> --- ` +
           `<a href="https://twitter.com/${username}">@${username}</a>: ${tweetText}`;
  }

  // extended mode includes tweet.full_text only
  tweetTextOf(tweet) {
    return tweet.full_text ? tweet.full_text : tweet.text;
  }

  tweetFirstMediaUrl(extendedTweet) {
    try {
        return extendedTweet.entities.media[0].media_url_https;
    } catch (err) {
        return false;
    }
  }

  toLocaleDate(twitterDate) {
     try {
      return dateFormat(new Date(twitterDate), "yyyy-mm-dd HH:MM:ss");
    } catch (err) {
      return twitterDate;
    }
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
