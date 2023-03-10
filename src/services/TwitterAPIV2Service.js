import dateFormat from 'dateformat';

import { TwitterApi } from 'twitter-api-v2';

import log4js from 'log4js';

const TWEET_MAX_LENGTH = 280;
const TWEET_QUERY_MAX_LENGTH = 512;
const TWITTER_EXCLUDED_ACCOUNTS = process.env.TWITTER_EXCLUDED_ACCOUNTS || false;

const DEBUG_DETAILS = false;
/**
 * Use of Twitter V2 API
 **/
export default class TwitterAPIV2Service {

  constructor(config, common) {
    this._common = common;
    this.logger = log4js.getLogger('TwitterAPIV2Service');
    this.logger.level = "INFO"; // DEBUG will show api params
    this.twitter1Config = config.twitter1;
    this.twitter2Config = config.twitter2;

    // https://github.com/plhery/node-twitter-api-v2/blob/HEAD/doc/basics.md
    // OAuth 1.0a (User context)
    // this.logger.debug(`twitter config: ${JSON.stringify(this.twitterConfig, null, 2)}`)
    this.twitterClient1 = new TwitterApi(this.twitter1Config);
    this.twitterClient1 = this.twitterClient1.readWrite;

    // https://github.com/plhery/node-twitter-api-v2/blob/HEAD/doc/basics.md
    // OAuth2 (app-only or user context)
    // Create a client with an already known bearer token
    this.twitterClient2 = new TwitterApi(this.twitter2Config.bearerToken);
    this.twitterClient2 = this.twitterClient2.readWrite;

    this.excludeQuery = _getExcludeQuery(config.twitterExclusions);
  }

  // https://github.com/PLhery/node-twitter-api-v2/blob/5748e3de432b527824f18d6eed4d23093faa08c4/doc/v2.md#get-a-single-tweet
  getSingleTweet(tweetId) {
    const service = this;
    return new Promise(async function(resolve, reject) {
      const expansions = [ 'author_id', 'referenced_tweets.id', 'entities.mentions.username', 'in_reply_to_user_id' ];
      const tweetDetails = await service.twitterClient2.v2.singleTweet(tweetId, { expansions })
                                        .catch( err => service.handleTweetError("v2.singleTweet errors", err, service.logger, reject))
      if (tweetDetails === undefined) {
        return;
      }
      service.logger.debug("v2.singleTweet", JSON.stringify(tweetDetails, null, 2));
      resolve(tweetDetails);
    });
  }

  // https://github.com/PLhery/node-twitter-api-v2/blob/5748e3de432b527824f18d6eed4d23093faa08c4/doc/v2.md#get-a-single-tweet
  getTweet(tweetId) {
    const service = this;
    return new Promise(async function(resolve, reject) {
      const options = service.applyAPIV2CommonOptions({ });
      const result = await service.twitterClient2.v2.singleTweet(tweetId, options)
                                        .catch( err => service.handleTweetError("v2.singleTweet errors", err, service.logger, reject))
      service.logger.debug("v2.singleTweet result", JSON.stringify(result));
      if (result === undefined) {
        return;
      }
      const toReturn = {tweets:result.includes.tweets, users:result.includes.users, medias: result.includes.media,
                        tweet: result.data};
      service.logger.debug("v2.singleTweet results", JSON.stringify({
          tweetId, options, toReturn
      }, null, 2));
      resolve(toReturn);
    });

  }

  async userTimeline(userId, max_results) {
    const service = this;
    service.logger.debug("userTimeline", {userId, max_results});
    return new Promise(async function(resolve, reject) {
      const options = service.applyAPIV2CommonOptions({ "max_results": Math.min(max_results, 100) });
      const timeline = await service.twitterClient2.v2.userTimeline(userId, options)
                                    .catch( err => service.handleTweetError(".v2.userTimeline errors", err, service.logger, reject));
      if (timeline === undefined) {
        return;
      }
      var tweets = timeline.tweets;
      var users =  timeline.includes.users
      var rateLimit = timeline.rateLimit;
      if (tweets?.length > 0 && tweets?.length < max_results) {
        do {
          var nextPage = await timeline.next();
          tweets = nextPage.tweets ? [...tweets, ...nextPage.tweets] : tweets;
          users = nextPage.users ? [...users, ...nextPage.users] : users;
          rateLimit = nextPage.rateLimit
          service.logger.debug("v2.userTimeline tweets length", tweets?.length, "rateLimit", rateLimit);
        } while (nextPage.tweets?.length > 0 && tweets?.length < max_results)
      }

      const toReturn = {tweets, users, rateLimit};
      DEBUG_DETAILS && service.logger.debug("v2.userTimeline.results", JSON.stringify({
          userId, options, "nb": toReturn.tweets.length
      }, null, 2));
      DEBUG_DETAILS && service.logger.debug("v2.userTimeline.rateLimit", JSON.stringify(timeline.rateLimit, null, 2));
      resolve(toReturn);
    });
  }

  // v2 operators: https://developer.twitter.com/en/docs/twitter-api/enterprise/rules-and-filtering/operators-by-product
  // query : https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/build-a-query
  searchRecent(searchQuery, max_results = 10) {
    const service = this;
    return new Promise(async function(resolve, reject) {
      const query = (searchQuery ? searchQuery : "") + service.excludeQuery;
      if (query.length > TWEET_QUERY_MAX_LENGTH) {
        reject(`Invalid query (max ${TWEET_QUERY_MAX_LENGTH}): ${query ? query.length + " - " + query : "(not set)"}`);
        return;
      }
      const options = service.applyAPIV2CommonOptions({ max_results });//  'media.fields': 'url'
        // options:
            // sort_order?: 'recency' | 'relevancy';
            // previous_token?: string;
            // query: string;
            //  /** ISO date string */
            //  end_time?: string;
            //  /** ISO date string */
            //  start_time?: string;
            //  max_results?: number;
            //  since_id?: string;
            //  until_id?: string;
            //  next_token?: string;
      const result = await service.twitterClient2.v2.search(query, options)
                                                   .catch( err => service.handleTweetError("v2.search errors", err, service.logger, reject));
      if (result === undefined) {
        return;
      }
      // DEBUG_DETAILS && service.logger.debug("v2.search", JSON.stringify(result, null, 2));
      const toReturn = {tweets:result.tweets, users:result.includes.users, medias: result.includes.media,
                        rateLimit:result.rateLimit};
      DEBUG_DETAILS && service.logger.debug("v2.search results", JSON.stringify({
          query, options, toReturn
      }, null, 2));
      DEBUG_DETAILS && service.logger.debug("v2.search.rateLimit", JSON.stringify(result.rateLimit, null, 2));

      service.logger.debug("v2.search", JSON.stringify({ query, tweets: tweetsSummaryOf(result.tweets)}, null, 2));
      resolve(toReturn);
    });
  }

  applyAPIV2CommonOptions(options) {
      const expansions = ['author_id',
                          'referenced_tweets.id', 'referenced_tweets.id.author_id',
                          'entities.mentions.username', 'in_reply_to_user_id','attachments.media_keys'];
      const tweetFields = ['author_id', 'source', 'created_at','entities','withheld',
                           // 'conversation_id', // find replies with search recent filter: conversation_id:1279940000004973111 only works for 7 days
                           'reply_settings', // check if we can reply to
                           'public_metrics'  // know if has reply
                           ];
      const userFields = ['username','id',]; // 'name','entities'
      const mediaFields = ['media_key','type', 'url', 'width'];
      options = {...options, expansions, 'tweet.fields':tweetFields, 'user.fields':userFields, 'media.fields': mediaFields }
      return options;
  }

  // searchAll : cant access : https://developer.twitter.com/en/docs/twitter-api/tweets/search/api-reference // Only available to those with Academic Research access

  getRecentlyMentionedUsers(userId, count) {
    const service = this;
    return new Promise(async function(resolve, reject) {
      const { tweets } = await service.userTimeline(userId, count).catch(reject);
      service.logger.debug(`service.userTimeline(${userId}, ${count}) : ${JSON.stringify(tweets)}`);
      if (tweets === undefined) {
        return;
      }
      const mentioned = service.tweetsUserMentionsNames(tweets);
      resolve(mentioned);
    });
  }
  // return tweeter screen names of user_mentions
  tweetsUserMentionsNames(tweets, mentionNames = []) {
    const service = this;
    if(!tweets || tweets.length < 0) {
      return mentionNames;
    }
    var mentioned = mentionNames;
    tweets.forEach(t => {
        mentioned = service.tweetUserMentionsNames(t, mentioned);
    });
    return mentioned;
  }

  // return tweeter screen names of user_mentions
  tweetUserMentionsNames(tweet, mentionNames = []) {
    tweet?.entities?.mentions?.forEach( m => { mentionNames.push(m.username) });
    return mentionNames;
  }

  getRecentlyAnsweredStatuses(userId, count) {
    const service = this;
    return new Promise(async function(resolve, reject) {
      var { tweets } = await service.userTimeline(userId, count).catch(reject);
      if (tweets === undefined) {
        return;
      }
      const referenced_tweets = [];
      tweets?.forEach(t => t.referenced_tweets?.filter(rt => rt.type === "replied_to")?.forEach( rt => referenced_tweets?.push(rt)));
      service.logger.debug("referenced_tweets length", referenced_tweets.length);
      var statusesIds = referenced_tweets?.map( t => t.id );
      // TODO pagination like for userTimeline
      resolve(statusesIds);
    });
  }

  //~ write operations
  replyTo(tweet, users, replyMsg, doSimulate, quoteTweet = null, quoteUsers = null) {
      const service = this;
      service.logger.debug("replyTo", JSON.stringify({tweet, replyMsg, doSimulate, quoteTweet, quoteUsers}, null, 2));
      const username = this.tweetAuthorNameOf(tweet, users);
      // add quoted username ?
      const replyStatus = `@${username} ${replyMsg}`;
      const replyLength = replyStatus.length;
      const replyToTweetId = tweet?.id;
      const quoteTweetId = quoteTweet?.id;
      if (replyLength > TWEET_MAX_LENGTH) {
        const cause = `(${replyStatus.length} > ${TWEET_MAX_LENGTH})`;
        return Promise.reject(`replyStatus too long ${cause} : ${replyStatus}`);
      }

      this._common.debug("Uses params to reply to : " + JSON.stringify({replyToTweetId, replyStatus, quoteTweetId}));
      this._common.info(`Plan to reply(${replyLength}) to => ` + this.tweetLinkOf(tweet, users));
      this._common.info(" " + this.tweetInfoOf(tweet, users));
      if (quoteTweetId) {
        this._common.info(" quote:" + this.tweetInfoOf(quoteTweet, quoteUsers));
      }

      if (doSimulate) {
          return Promise.resolve({
            "edit_history_tweet_ids": ["1234"],
            "id":"1234",
            "text": "SIMULATION - SIMULATION - SIMULATION - "+replyStatus,
          });
      }
      if (quoteTweetId) {
        return service.replyAndQuote(replyToTweetId, quoteTweetId, replyStatus)
      }
      return service.reply(replyToTweetId, replyStatus);
  }

  // https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/v2.md#create-a-tweet
  tweet(message, options) {
    const service = this;
    return new Promise(async (resolve, reject) => {
      const { data: createdTweet } = await service.twitterClient1.v2.tweet(message, options)
                           .catch( err => service.handleTweetError("v2.tweet error", err, service.logger, reject));
      if (createdTweet === undefined) {
        return;
      }
      service.logger.debug("v2.tweet result "+ JSON.stringify(createdTweet));
      resolve(createdTweet);//result {"edit_history_tweet_ids":["1634274798577627137"],"id":"1634274798577627137","text":"this is for #testPurpose"}
    });
  }

  // https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/v2.md#reply-to-a-tweet
  reply(tweetId, message) {
    const service = this;
    return new Promise(async (resolve, reject) => {
      const { data: replyTweet } = await service.twitterClient1.v2.reply(message, tweetId)
                           .catch( err => service.handleTweetError("v2.reply error", err, service.logger, reject));
      if (replyTweet === undefined) {
        return;
      }
      service.logger.debug("v2.reply result "+ JSON.stringify(replyTweet));
      resolve(replyTweet);//result {"edit_history_tweet_ids":["1634279050268102667"],"id":"1634279050268102667","text":"this is a reply for #testPurpose"}
    });
  }

   // reply to with quote : cf. node_modules/twitter-api-v2/dist/cjs/v2/client.v2.write.js l95
  replyAndQuote(tweetId, quotedTweetId, message) {
    const service = this;
    return new Promise(async (resolve, reject) => {
      const reply = { in_reply_to_tweet_id: tweetId };
      const options = { text: message, reply, quote_tweet_id: quotedTweetId };
      const { data: replyQTweet } = await service.twitterClient1.v2.post('tweets', options)
                           .catch( err => service.handleTweetError("v2.reply Q error", err, service.logger, reject));
      if (replyQTweet === undefined) {
        return;
      }
      service.logger.debug("v2.reply Q result "+ JSON.stringify(replyQTweet));
      resolve(replyQTweet);//result {"edit_history_tweet_ids":["1634281917016166404"],"id":"1634281917016166404","text":"this is a reply+quote for #testPurpose https://t.co/QbbF9qSJrf"}
    });
  }

  // https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/v2.md#delete-a-tweet
  deleteTweet(tweetId) {
    const service = this;
    return new Promise(async (resolve, reject) => {
      const deleteResult = await service.twitterClient1.v2.deleteTweet(tweetId)
                           .catch( err => service.handleTweetError("v2.deleteTweet error", err, service.logger, reject));
      service.logger.debug("v2.deleteTweet result "+ JSON.stringify({tweetId, deleteResult}));
      resolve(resolve);//  result {"data":{"deleted":true}}
    });
  }

  //~ pojo operations
  tweetLinkOf(tweet, users) {
    const tweetId = tweet?.id;
    const username = this.tweetAuthorNameOf(tweet, users);
    if (!tweet || !tweetId || !username) {
      return "";
    }
    return `https://twitter.com/${username}/status/${tweetId}`;
  }

  tweetReplyLinkOf(tweet) {
    const tweetId = tweet?.id;
    const username = "botEnTrain1";
    if (!tweet || !tweetId || !username) {
      return "";
    }
    return `https://twitter.com/${username}/status/${tweetId}`;
  }

  tweetInfoOf(tweet, users) {
    const username = this.tweetAuthorNameOf(tweet, users);
    const tweetText = this.tweetTextOf(tweet);
    const tweetDate = tweet.created_at ? this.toLocaleDate(tweet.created_at) : "";
    if (!tweet || !username || !tweetText || !tweetDate) {
      return "";
    }
    return `${tweetDate} --- @${username}: ${tweetText}`;
  }

  tweetReplyInfoOf(tweet) {
    const username = "botEnTrain1";
    const tweetText = this.tweetTextOf(tweet);
    if (!tweet || !username || !tweetText) {
      return "";
    }
    return `Reply --- @${username}: ${tweetText}`;
  }

  // extended mode includes tweet.full_text only
  tweetTextOf(tweet) {
    return tweet.full_text ? tweet.full_text : tweet.text;
  }

  tweetHtmlOf(tweet, users) {
    const tweetId = tweet?.id;
    const username = users?.find( u => u.id === tweet.author_id )?.username;
    const tweetText = this.tweetTextOf(tweet);
    const tweetDate = tweet.created_at ? this.toLocaleDate(tweet.created_at) : "";
    if (!tweet || !username || !tweetText || !tweetDate) {
      return "";
    }
    return `<a href="https://twitter.com/${username}/status/${tweetId}">${tweetDate}</a> --- ` +
           `<a href="https://twitter.com/${username}">@${username}</a>: ${tweetText}`;
  }

  tweetReplyHtmlOf(tweet) {
    const tweetId = tweet?.id;
    const username = "botEnTrain1";
    const tweetText = this.tweetTextOf(tweet);
    if (!tweet || !username || !tweetText) {
      return "";
    }
    return `<a href="https://twitter.com/${username}/status/${tweetId}">Reply</a> --- ` +
           `<a href="https://twitter.com/${username}">@${username}</a>: ${tweetText}`;
  }

  toLocaleDate(twitterDate) {
     try {
      return dateFormat(new Date(twitterDate), "yyyy-mm-dd HH:MM:ss");
    } catch (err) {
      return twitterDate;
    }
  }

  tweetAuthorNameOf(tweet, users) {
    return users?.find( u => u.id === tweet?.author_id )?.username;
  }

  tweetFirstPhotoMedia(tweet, medias) {
    try {
        const tweetMediaKeys = tweet?.attachments?.media_keys;
        if (!tweetMediaKeys || tweetMediaKeys.length < 1) {
           return false;
        }
        for (const tweetMediaKey of tweetMediaKeys) {
          const media = medias?.find( m => m.media_key === tweetMediaKey && m.type === 'photo');
          if (media) {
            return media;
          }
        }
        return false;
    } catch (err) {
        return false;
    }
  }

  handleTweetError(action, err, logger, reject) {
    logger.debug(action, JSON.stringify(err, null, 2));
    const errors = TwitterApi.getErrors(err); // ErrorV1[]
    const rejectResult = (errors !== undefined && JSON.stringify(errors) !== "[]") ? errors :
                         isJsonString(err) ? JSON.stringify(err, null, 2) :
                         err;
    logger.debug(action, rejectResult);
    reject(rejectResult);
  }

  statusFromTweetUrl(tweetUrl) {
    const string = "https://twitter.com/TelaBotanica/status/1317431664784662528";
    const regexp = /https:\/\/twitter.com\/([^\/]+)\/status\/([0-9]+)/;
    const matches = string.match(regexp);
    const user = matches[1];
    const status = matches[2];
    return status;
  }

}

//~private
function _getExcludeQuery(exclusions = null) {
  var exclusionValidation = RegExp(/^[a-zA-Z\;]*$/);
  if (exclusions !== null && !exclusionValidation.test(exclusions)) {
      throw "TwitterAPIV2Service, invalid exclusions, expect semicolon separated twitter accounts (ex. \"elie;jeanDidier\")";
  }
  return exclusions !== null ? exclusions.split(";").map( e =>` (-from:${e})`).join() : "";
}


function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function tweetsSummaryOf(tweets) {
  if (!tweets || tweets.length < 1) {
    return "none";
  }
  const tweetsList = tweets.map(t => { return t.id + ": " + t.text; });
  return { "count": tweets.length, "tweets": tweetsList };
}

