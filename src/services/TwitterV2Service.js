import dateFormat from 'dateformat';

import { TwitterApi } from 'twitter-api-v2';// https://github.com/PLhery/node-twitter-api-v2/blob/5748e3de432b527824f18d6eed4d23093faa08c4/doc/v2.md#get-a-single-tweet

import log4js from 'log4js';

const TWEET_MAX_LENGTH = 280;
const TWEET_QUERY_MAX_LENGTH = 500;
const TWITTER_EXCLUDED_ACCOUNTS = process.env.TWITTER_EXCLUDED_ACCOUNTS || false;

export default class TwitterV2Service {

  constructor(config, common) {
    this._common = common;
    this.logger = log4js.getLogger('TwitterV2Service');
    this.logger.level = "DEBUG"; // DEBUG will show api params
    this.excludeQuery = _getExcludeQuery();
    this.twitterConfig = config.twitter;

    // https://github.com/plhery/node-twitter-api-v2/blob/HEAD/doc/basics.md
    // OAuth 1.0a (User context)
    // this.logger.debug(`twitter config: ${JSON.stringify(this.twitterConfig, null, 2)}`)
    this.twitterClient = new TwitterApi(this.twitterConfig);
    this.twitterClient = this.twitterClient.readWrite;
  }

  // https://developer.twitter.com/en/docs/tweets/post-and-engage/overview
  //   GET statuses/show/:id
  //   https://github.com/PLhery/node-twitter-api-v2/blob/5748e3de432b527824f18d6eed4d23093faa08c4/doc/v1.md#get-a-single-tweet
  async getTweetDetails(tweetId) {
      return this.twitterClient.v1.singleTweet(tweetId);
      /*
      const v2TweetOf = await this.twitterClient.v2.singleTweet(tweetId, {
        expansions: [
          'entities.mentions.username',
          'in_reply_to_user_id',
        ],
      });
      this.logger.debug("v2TweetOf", v2TweetOf);
      */
  }

  /* **breaking change!** */
  userTimeline(username, count) {
    const service = this;
    return new Promise(function(resolve, reject) {
      service.twitterClient.v1.userTimelineByUsername(username, { count })
                           .then( userTimeline => { resolve(userTimeline.tweets); })
                           .catch( reject );
    });
  }

  searchV1(searchQuery, count = 10, extendedMode = true) {
    const service = this;
    const query = searchQuery + this.excludeQuery;
    if (!query || query.length > TWEET_QUERY_MAX_LENGTH) {
      return Promise.reject(`Invalid query (max ${TWEET_QUERY_MAX_LENGTH}): ${query ? query.length + " - " + query : "(not set)"}`);
    }
    let params = { q: query, count };
    params.result_type = 'recent'; // 'mixed';
    params.lang = 'fr';
    if (extendedMode) {
      params.tweet_mode = "extended";
    }
    return new Promise(function(resolve, reject) {
      service.twitterClient.v1.get('search/tweets.json', params)
                           .then( result => { resolve(result.statuses); }) // dont forward result.search_metadata
                           .catch( reject );
    });
  }

  // need v2 auth
  searchRecentV2(searchQuery, max_results = 10) {
    const service = this;
    const query = searchQuery + this.excludeQuery;
    if (!query || query.length > TWEET_QUERY_MAX_LENGTH) {
      return Promise.reject(`Invalid query (max ${TWEET_QUERY_MAX_LENGTH}): ${query ? query.length + " - " + query : "(not set)"}`);
    }
    const options = { max_results, 'media.fields': 'url' };
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
    return service.twitterClient.v2.search(query, options);
  }


  replyTo(tweet, replyMsg, doSimulate) {
      const service = this;
      const replyStatus = `@${tweet.user.screen_name} ${replyMsg}`;
      const replyLength = replyStatus.length;
      if (replyLength > TWEET_MAX_LENGTH) {
        const cause = `(${replyStatus.length} > ${TWEET_MAX_LENGTH})`;
        return Promise.reject(`replyStatus too long ${cause} : ${replyStatus}`);
      }
      const params = {
        in_reply_to_status_id: tweet.id_str,
        status: replyStatus
      };

      this._common.debug("Uses params to reply to : " + JSON.stringify(params));
      this._common.info(`Plan to reply(${replyLength}) to => ` + this.tweetLinkOf(tweet));
      this._common.info(" " + this.tweetInfoOf(tweet));

      if (doSimulate) {
          return Promise.resolve({
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
      }
      return new Promise(function(resolve, reject) {
        service.twitterClient.v1.post('statuses/update.json', params)
                             .then( result => {
                               service.logger.info("POST statuses/update "+ JSON.stringify(params) + " - result" + result);
                               resolve(result);
                             })
                             .catch( error => {
                               service.logger.error("POST statuses/update:" + JSON.stringify(params) + " - err:" + error);
                               reject(error);
                             } );
      });
  }

  getRecentlyMentionedUsers(userName, count) {
    const service = this;
    return new Promise(async function(resolve, reject) {
      const extendedMode = true;
      const tweets = await service.userTimeline(userName, count).catch(reject);
      // service.logger.debug(`service.userTimeline(${userName}, ${count}) : ${JSON.stringify(tweets)}`);
      if (tweets === undefined) {
        return;
      }
      const mentioned = service.tweetsUserMentionsNames(tweets);
      service._common.debug(mentioned);
      resolve(mentioned);
    });
  }

  getRecentlyAnsweredStatuses(userName, count) {
    const service = this;
    return new Promise(async function(resolve, reject) {
      const extendedMode = true;
      const tweets = await service.userTimeline(userName, count, !extendedMode)
                                  .catch(reject);
      if (tweets === undefined) {
        return;
      }
      var statusesIds = [];
      tweets.forEach((t) => {
          statusesIds.push(t.in_reply_to_status_id_str);
      });
      resolve(statusesIds);
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
    if(!tweet || !tweet.entities || !tweet.entities.user_mentions) {
      return mentionNames;
    }
    tweet.entities.user_mentions.forEach((m) => {
        mentionNames.push(m.screen_name);
    });
    return mentionNames;
  }

  toLocaleDate(twitterDate) {
     try {
      return dateFormat(new Date(twitterDate), "yyyy-mm-dd HH:MM:ss");
    } catch (err) {
      return twitterDate;
    }
  }

}

//~private
function _getExcludeQuery() {
  var exclusionValidation = RegExp(/^[a-zA-Z\;]*$/);
  if (TWITTER_EXCLUDED_ACCOUNTS && !exclusionValidation.test(TWITTER_EXCLUDED_ACCOUNTS)) {
      throw "TwitterService, invalid TWITTER_EXCLUDED_ACCOUNTS, expect semicolon separated twitter accounts (ex. \"elie;jeanDidier\")";
  }
  return TWITTER_EXCLUDED_ACCOUNTS ? TWITTER_EXCLUDED_ACCOUNTS.split(";").map((e)=>" -from:"+e).join() : "";
}