import log4js from 'log4js';

import { TwitterSearchConstants as search, BetSearchConstants as betSearch } from '../services/TwitterSearchConstants.js';

export default class DialogBTP {
  constructor(common, twitterAPIV2Service, plantnetBTP, filmBTP) {
    this.isAvailable = false;
    this.logger = log4js.getLogger('YesMasterBTP');
    this.logger.level = "INFO";
    this.common = common;
    this.twitterAPIV2Service = twitterAPIV2Service;
    this.plantnetBTP = plantnetBTP;
    this.filmBTP = filmBTP;
    this.isAvailable = this.plantnetBTP.isReady() && this.filmBTP.isReady();
    this.logger.info((this.isAvailable ? "available" : "not available"));
  }

  getName() {
    return "YesMasterBTP";
  }

  getPluginTags() {
    return ["#BetOrder"].join(' ');
  }

  isReady() {
    return this.isAvailable;
  }

  hasCandidate(tweets, reject) {
    const plugin = this;
    const pluginName = plugin.getName();
    if (tweets === undefined) { // already rejected
      return false;
    }
    if (tweets.length < 1) {
      plugin.logger.info("no candidate for " + pluginName);
      reject({ "message": "aucun candidat pour " + pluginName, "status": 202});
      return false;
    }
    return true;
  }

  async searchOrder(reject) {
    const plugin = this;
    const searchOrder = "(\"@botentrain1\") (\"reply please\" OR \"réponds\" OR \"répondez\")" + search.IS_REPLY + search.NOT_RETWEET + betSearch.NOT_ME;
    var {tweets, users} = await plugin.twitterAPIV2Service.searchRecent(searchOrder, 100)
                                                         .catch(reject);
    return {tweets, users};
  }

  async filterRecentAnswers(tweets, reject) {
    const plugin = this;
    const common = plugin.common;
    const pluginName = plugin.getName();
    plugin.logger.debug("get recent answers");
    const recentAnswersIds = await plugin.twitterAPIV2Service.getRecentlyAnsweredStatuses(betSearch.BET_ID, 100)// valid range : 5..100
                                         .catch(err => {
                                            plugin.logError("twitterV2Service.getRecentlyAnsweredStatuses", {botEnTrainId, err});
                                            reject("Unable to search tweets");
                                            return false;
                                         });
    if (recentAnswersIds === undefined) {// rejected
      return undefined;
    }
    var filteredTweets = tweets;
    plugin.logger.debug("recentAnswersIds",JSON.stringify(recentAnswersIds));
    if (common.arrayWithContent(tweets) && common.arrayWithContent(recentAnswersIds)) {
      filteredTweets = common.filterTweetsExcludingIds(tweets, recentAnswersIds);
      plugin.logger.debug("Exclude " + (tweets.length - filteredTweets.length));
    }
    return filteredTweets;
  }

  async getOrderAndCandidate(reject) {
      const plugin = this;
      var {tweets, users} = await plugin.searchOrder(reject);
      if (!plugin.hasCandidate(tweets, reject)) {
        return undefined;//already rejected
      }
      // improvement : si tous les tweets n'ont pas de reply alors on skip l'étape de filtre
      tweets = await plugin.filterRecentAnswers(tweets, reject);
      if (!plugin.hasCandidate(tweets, reject)) {
        return undefined;//already rejected
      }

      const orderTweet = tweets[0];
      const orderUsers = users;
      const orderText = orderTweet.text;
      const orderRefTweet =  orderTweet.referenced_tweets?.find(t => t.type === "replied_to")?.id;
      plugin.logger.info(
        "Order: ", plugin.twitterAPIV2Service.tweetInfoOf(orderTweet, orderUsers),
        "RefTweet id", orderRefTweet
      );
      var candidate;
      {
        const {users, medias, tweet} = await plugin.twitterAPIV2Service.getTweet(orderRefTweet).catch(reject);
        if (tweet === undefined) { return; } // rejected
        candidate = {users, medias, tweet};
        plugin.logger.info("candidate", plugin.twitterAPIV2Service.tweetInfoOf(candidate.tweet, candidate.users));
      }
      var order;
      {
        const {users, medias, tweet} = await plugin.twitterAPIV2Service.getTweet(orderTweet.id).catch(reject);
        if (tweet === undefined) { return; } // rejected
        order = {users, medias, tweet};
        plugin.logger.info("order", plugin.twitterAPIV2Service.tweetInfoOf(order.tweet, order.users));
      }
      return {order, candidate}
  }


  process(config) {
    const plugin = this;
    const common = this.common;
    const pluginName = plugin.getName();
    const pluginMoreTags = plugin.getPluginTags();
    const pluginConfig = config;

    return new Promise(async function(resolve, reject) {
      const orderAndCandidate = await plugin.getOrderAndCandidate(reject);
      if (orderAndCandidate === undefined) {// reject case
        return;
      }
      const {order, candidate} = orderAndCandidate;
      config = { ...config, pluginMoreTags, order, candidate };
      await plugin.plantnetBTP.replyToTweet(config)
        .then(resolve)
        .catch( async err => {
          if (err.status !== 400) {
            reject(err);
            return;
          }
          plugin.logger.info("no candidate for plantnetBTP :  ", err.message);

          await plugin.filmBTP.replyToTweet(config)
            .then(resolve)
            .catch(err => {
                if (err.status !== 400) {
                  reject(err);
                  return;
                }
                plugin.logger.info("no candidate for filmBTP : ", err.message);
                reject({ "message": "aucun candidat pour " + pluginName, "status": 202});
            });

        });

    });
  }

}
