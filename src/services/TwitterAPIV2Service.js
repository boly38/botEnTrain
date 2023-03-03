import dateFormat from 'dateformat';

import { TwitterApi } from 'twitter-api-v2';

import log4js from 'log4js';

const TWEET_MAX_LENGTH = 280;
const TWEET_QUERY_MAX_LENGTH = 512;
const TWITTER_EXCLUDED_ACCOUNTS = process.env.TWITTER_EXCLUDED_ACCOUNTS || false;

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

  async userTimeline(userId, max_results) {
    const service = this;
    service.logger.debug("userTimeline", {userId, max_results});
    return new Promise(async function(resolve, reject) {
      const options = service.applyAPIV2CommonOptions({ max_results });
      const timeline = await service.twitterClient2.v2.userTimeline(userId, options)
                                    .catch( err => service.handleTweetError(".v2.userTimeline errors", err, service.logger, reject));
      if (timeline === undefined) {
        return;
      }
      service.logger.debug("v2.userTimeline", JSON.stringify(timeline, null, 2));

      const toReturn = {tweets:timeline.tweets, users:timeline.includes.users, rateLimit:timeline.rateLimit};
      service.logger.debug("v2.userTimeline.results", JSON.stringify({
          userId, options, toReturn
      }, null, 2));
      service.logger.debug("v2.userTimeline.rateLimit", JSON.stringify(timeline.rateLimit, null, 2));
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
      service.logger.debug("v2.search", JSON.stringify(result, null, 2));
      const toReturn = {tweets:result.tweets, users:result.includes.users, medias: result.includes.media,
                        rateLimit:result.rateLimit};
      service.logger.debug("v2.search results", JSON.stringify({
          query, options, toReturn
      }, null, 2));
      service.logger.debug("v2.search.rateLimit", JSON.stringify(result.rateLimit, null, 2));
      resolve(toReturn);
    });
  }

  applyAPIV2CommonOptions(options) {
      const expansions = ['author_id', 'referenced_tweets.id', 'referenced_tweets.id.author_id',
                          'entities.mentions.username', 'in_reply_to_user_id','attachments.media_keys'];
      const tweetFields = ['author_id', 'source', 'created_at','entities','withheld'];
      const userFields = ['username','id',]; // 'name','entities'
      const mediaFields = ['media_key','type', 'url', 'width'];
      options = {...options, expansions, 'tweet.fields':tweetFields, 'user.fields':userFields, 'media.fields': mediaFields }
      return options;
  }

  // searchAll : cant access : https://developer.twitter.com/en/docs/twitter-api/tweets/search/api-reference // Only available to those with Academic Research access

  replyTo(tweet, users, replyMsg, doSimulate) {
      const service = this;
      service.logger.debug("replyTo", JSON.stringify({tweet, replyMsg, doSimulate}, null, 2));
      const username = this.tweetAuthorNameOf(tweet, users);
      const replyStatus = `@${username} ${replyMsg}`;
      const replyLength = replyStatus.length;
      if (replyLength > TWEET_MAX_LENGTH) {
        const cause = `(${replyStatus.length} > ${TWEET_MAX_LENGTH})`;
        return Promise.reject(`replyStatus too long ${cause} : ${replyStatus}`);
      }
      const params = {
        in_reply_to_status_id: tweet.id,
        status: replyStatus
      };

      this._common.debug("Uses params to reply to : " + JSON.stringify(params));
      this._common.info(`Plan to reply(${replyLength}) to => ` + this.tweetLinkOf(tweet, users));
      this._common.info(" " + this.tweetInfoOf(tweet, users));

      if (doSimulate) {
          return Promise.resolve({
            "edit_history_tweet_ids": ["1234"],
            "id":"1234",
            "text": "SIMULATION - "+replyStatus,
          });
      }
      return new Promise(function(resolve, reject) {
        // reply uses OAuth 1.0a
        service.twitterClient1.v2.reply(params.status, params.in_reply_to_status_id)
                             .then( result => {
                               service.logger.debug("v2.reply result "+ JSON.stringify(params) + " - result: " + JSON.stringify(result));
                               resolve(result.data);
                             })
                             .catch( err => service.handleTweetError("v2.reply error", err, service.logger, reject));
      });
  }

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
      const { tweets } = await service.userTimeline(userId, count).catch(reject);
      if (tweets === undefined) {
        return;
      }
      const referenced_tweets = [];
      tweets?.forEach(t => t.referenced_tweets?.filter(rt => rt.type === "replied_to")?.forEach( rt => referenced_tweets?.push(rt)));
      service.logger.debug("referenced_tweets", referenced_tweets);
      var statusesIds = referenced_tweets?.map( t => t.id );
      resolve(statusesIds);
    });
  }

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
    const errors = TwitterApi.getErrors(err); // ErrorV1[]
    const rejectResult = (errors !== undefined && JSON.stringify(errors) !== "[]") ? errors :
                         isJsonString(err) ? JSON.stringify(err, null, 2) :
                         err;
    logger.debug(action, rejectResult);
    reject(rejectResult);
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