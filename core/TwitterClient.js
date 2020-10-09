const dateFormat = require('dateformat');
const Twit = require('twit');
const log4js = require('log4js');

const TWEET_MAX_LENGTH = 280;
const TWEET_QUERY_MAX_LENGTH = 500;
const TWITTER_EXCLUDED_ACCOUNTS = process.env.TWITTER_EXCLUDED_ACCOUNTS || false;

class TwitterClient {
  constructor() {
    this.logger = log4js.getLogger('TwitterClient');
    this.logger.setLevel('DEBUG'); // DEBUG will show api params
    this._assumeEnvironment();
    this._assumeExcludeQuery();
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
  getTweetDetails(tweetId, cb) {
      let params = {
        "id": tweetId,
        "tweet_mode":"extended"
      };
        // useless "include_entities": true,
      this.twit.get('statuses/show', params, (err, data, response) => {
        if(!err){
          this.logger.debug("GET statuses/show:" + JSON.stringify(params) + " - result:" +
            JSON.stringify(data));
            cb(false, data);
        } else {
          this.logger.error("GET statuses/show:" + params + " - err:" + err);
          cb(err);
        }
      });
  }

  userTimeline(userName, searchCount, extendedMode, cb) {
      // doc: https://developer.twitter.com/en/docs/tweets/timelines/api-reference/get-statuses-user_timeline
      let params = {
        screen_name: userName,
        exclude_replies: false,
        count: searchCount
      };
      if (extendedMode) {
        params.tweet_mode = "extended";
      }

      this.twit.get('statuses/user_timeline', params, (err, data, response) => {
        if(!err){
          let tweets = data;
          this.logger.debug("GET statuses/user_timeline:" + JSON.stringify(params) + " - result count:" + tweets.length);
          cb(false, tweets);
        } else {
          this.logger.error("GET statuses/user_timeline:" + params + " - err:" + err);
          cb(err);
        }
      });
  }

  // search query operators : https://developer.twitter.com/en/docs/tweets/search/guides/standard-operators
  search(searchQuery, searchCount, extendedMode, cb) {
      var twitterQuery = searchQuery + this.excludeQuery;
      // Search parameters
      // doc: https://developer.twitter.com/en/docs/tweets/rules-and-filtering/overview/standard-operators
      if (!twitterQuery || twitterQuery.length > TWEET_QUERY_MAX_LENGTH) {
        cb("Invalid query (max " + TWEET_QUERY_MAX_LENGTH + "): " +
          (twitterQuery ? twitterQuery.length + " - " + twitterQuery : "(not set)"));
        return;
      }
      let params = {
        q: twitterQuery,
        count: searchCount,
      };
      params.result_type = 'recent'; // 'mixed';
      params.lang = 'fr';
      if (extendedMode) {
        params.tweet_mode = "extended";
      }

      this.twit.get('search/tweets', params, (err, data, response) => {
        if(!err){
          let tweets = data.statuses;
          this.logger.debug("GET search/tweets:" + JSON.stringify(params) + " - result count:" + tweets.length);
          cb(false, tweets);
        } else {
          this.logger.error("GET search/tweets:" + JSON.stringify(params) + " - err:" + err);
          cb(err);
        }
      });
  }

  replyTo(tweet, replyMsg, doSimulate, cb) {
      let replyStatus = `@${tweet.user.screen_name} ${replyMsg}`;
      let replyLength = replyStatus.length;
      if (replyLength > TWEET_MAX_LENGTH) {
        let cause = `(${replyStatus.length} > ${TWEET_MAX_LENGTH})`;
        cb(`replyStatus too long ${cause} : ${replyStatus}`);
        return;
      }
      let params = {
        in_reply_to_status_id: tweet.id_str,
        status: replyStatus
      };

      this.logger.debug("Uses params to reply to : " + JSON.stringify(params));
      this.logger.info(`Plan to reply(${replyLength}) to => ` + this.tweetLinkOf(tweet));
      this.logger.info(" " + this.tweetInfoOf(tweet));

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
          this.logger.info("POST statuses/update "+ JSON.stringify(params) + " - result" + data);
          cb(false, data);
        } else {
          this.logger.error("POST statuses/update:" + JSON.stringify(params) + " - err:" + err);
          cb(err);
        }
      });
  }

  getRecentlyMentionedUsers(userName, count, cb) {
    let extendedMode = true;
    this.userTimeline(userName, count, !extendedMode, (err,tweets) => {
      let mentioned = [];
      if (err) {
        cb(err);
        return;
      }
      // this.logger.debug(JSON.stringify(tweets));
      tweets.forEach((t) => {
          if (!t.entities || !t.entities.user_mentions) {
            return;
          }
          t.entities.user_mentions.forEach((mention) => {
              mentioned.push(mention.screen_name);
          });
      });
      cb(false, mentioned);
      return;
    });
  }

  getRecentlyAnsweredStatuses(userName, count, cb) {
    let extendedMode = true;
    this.userTimeline(userName, count, !extendedMode, (err,tweets) => {
      let statusesIds = [];
      if (err) {
        cb(err);
        return;
      }
      // this.logger.debug(JSON.stringify(tweets));
      tweets.forEach((t) => {
          statusesIds.push(t.in_reply_to_status_id_str);
      });
      cb(false, statusesIds);
      return;
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

  // return tweeter screen names of user_mentions
  tweetUserMentionsNames(tweet) {
    this.logger.debug("tweetUserMentionsNames " + JSON.stringify(tweet));
    if(!tweet || !tweet.entities || !tweet.entities.user_mentions) {
      this.logger.debug("tweetUserMentionsNames => []");
      return [];
    }
    let mentionNames = [];
    tweet.entities.user_mentions.forEach((m) => {
        mentionNames.push(m.screen_name);
    });
    this.logger.debug("tweetUserMentionsNames => " + mentionNames);
    return mentionNames;
  }

  toLocaleDate(twitterDate) {
     try {
      return dateFormat(new Date(twitterDate), "yyyy-mm-dd HH:MM:ss");
    } catch (err) {
      return twitterDate;
    }
  }

  // ~ private
  _assumeEnvironment() {
    if (!process.env.APPLICATION_CONSUMER_KEY_HERE ||
    !process.env.APPLICATION_CONSUMER_SECRET_HERE ||
    !process.env.ACCESS_TOKEN_HERE ||
    !process.env.ACCESS_TOKEN_SECRET_HERE) {
        throw "TwitterClient, please setup your environment";
    }
  }

  _assumeExcludeQuery() {
    var exclusionValidation = RegExp(/^[a-zA-Z\;]*$/);
    if (TWITTER_EXCLUDED_ACCOUNTS && !exclusionValidation.test(TWITTER_EXCLUDED_ACCOUNTS)) {
        throw "TwitterClient, invalid TWITTER_EXCLUDED_ACCOUNTS, expect semicolon separated twitter accounts (ex. \"elie;jeanDidier\")";
    }
    this.excludeQuery = TWITTER_EXCLUDED_ACCOUNTS ? TWITTER_EXCLUDED_ACCOUNTS.split(";").map((e)=>" -from:"+e).join() : "";
  }

}

module.exports = TwitterClient;
