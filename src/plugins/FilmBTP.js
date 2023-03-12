import log4js from 'log4js';
import fs     from 'fs';

const BEHAVIOR_TEST_INDEX = process.env.BEHAVIOR_TEST_INDEX || false;

export default class FilmBTP {

  constructor(common, twitterAPIV2Service) {
    this.isAvailable = false;
    this.logger = log4js.getLogger('FilmBTP');
    this.logger.level = "INFO"; // DEBUG will show search results
    this.common = common;
    this.twitterAPIV2Service = twitterAPIV2Service;
    try {
        const behaviorsData = fs.readFileSync('src/data/filmBtp.json');
        this.behaviors = JSON.parse(behaviorsData);
        this.isAvailable = true;
        this.logger.info("available with " + this.behaviors.length + " behaviors");
    } catch (exception) {
        this.logger.error(exception);
    }
  }

  getName() {
    return "FilmBTP";
  }

  getPluginTags() {
    return ["#BetFilm","#RepliquesDeFilms"].join(' ');
  }

  getSearch() {
    if (!this.behaviors) {
      return [];
    }
    return this.common.clone(this.behaviors).map(b => b.search);
  }

  isReady() {
    return this.isAvailable;
  }

  candidateFirstMatchingBehavior(candidate) {
    const plugin = this;
    const common = plugin.common;
    const candidateText = candidate?.tweet?.text;
    if (!candidateText) {
      plugin.logger.debug("!candidateText", candidateText);
      return false;
    }

    const matchBehaviors = common.clone(plugin.behaviors).filter(b => candidateText.includes(b.search));
    plugin.logger.debug("matchBehaviors", matchBehaviors.length, "candidateText", candidateText);
    return (matchBehaviors.length > 0) ? matchBehaviors[0] : undefined;
  }

  replyToTweet(config) {
    const plugin = this;
    var tags = plugin.getPluginTags();
    var { pluginName, pluginTags, pluginMoreTags, doSimulate, order, candidate } = config;
    if (pluginMoreTags !== undefined) {
      tags = [tags, pluginMoreTags].join(' ');
    }

    const behavior = plugin.candidateFirstMatchingBehavior(candidate);
    if (!behavior) {
      return Promise.reject({ "message": "candidate dont match plugin requirements", "status": 400});
    }
    plugin.logger.debug("behavior", behavior);

    const replyToTweet = order?.tweet ? order?.tweet : candidate.tweet;
    const replyToUsers = order?.tweet ? order?.users : candidate.users;
    const quoteToTweet = order?.tweet ? candidate.tweet : undefined;
    const quoteToUsers = order?.tweet ? candidate.users : undefined;

    return new Promise(async function(resolve, reject) {
      const repTweet = await plugin.replyTweet(doSimulate, replyToTweet, replyToUsers, behavior, tags, quoteToTweet, quoteToUsers)
                                     .catch(err => {
                                       plugin.logger.error(err);
                                       reject({"message": "impossible de répondre au tweet", "status": 500});
                                     });

      if (repTweet !== undefined) {
          resolve({
              "html": "<b>Tweet</b>:" +
                  "<div class=\"bg-info\">" + plugin.twitterAPIV2Service.tweetHtmlOf(replyToTweet, replyToUsers) + "</div>" +
                  (quoteToTweet ? ("<div class=\"bg-info\">Quote "+plugin.twitterAPIV2Service.tweetHtmlOf(quoteToTweet, quoteToUsers)+ "</div>") : "") +
                  "<b>Réponse émise</b>: " +
                  plugin.twitterAPIV2Service.tweetReplyHtmlOf(repTweet),
              "text": "\nTweet:\n\t" +
                  plugin.twitterAPIV2Service.tweetLinkOf(replyToTweet, replyToUsers) + "\n\t" +
                  plugin.twitterAPIV2Service.tweetInfoOf(replyToTweet, replyToUsers) + "\n" +
                  (quoteToTweet ? ("\nQuote:\n\t" +
                                   plugin.twitterAPIV2Service.tweetLinkOf(quoteToTweet, quoteToUsers) + "\n\t" +
                                   plugin.twitterAPIV2Service.tweetInfoOf(quoteToTweet, quoteToUsers) + "\n") : "") +
                  "Reply sent:\n\t" +
                  plugin.twitterAPIV2Service.tweetReplyLinkOf(repTweet) + "\n\t" +
                  plugin.twitterAPIV2Service.tweetReplyInfoOf(repTweet) + "\n"
          });
      }
    });
  }


  process(config) {
    const plugin = this;
    const common = plugin.common;
    var { pluginName, pluginTags, pluginMoreTags, doSimulate, tweet } = config;
    if (config.pluginName === undefined) {
      pluginName = plugin.getName();
    }
    if (pluginTags === undefined) {
      pluginTags = plugin.getPluginTags();
    }
    if (pluginMoreTags !== undefined) {
      [pluginTags, pluginMoreTags].join(' ');
    }
    doSimulate = config.doSimulate || false;
    plugin.logger.info("config", JSON.stringify(config));

    if (config.targetTweet && config.searchExtra) {
      return plugin.searchTweetToReplyTo(config);
    }

    /** RANDOM TWEET from behavior */
    return new Promise(async function promise(resolve, reject) {
      const behavior = BEHAVIOR_TEST_INDEX && plugin.behaviors.length > BEHAVIOR_TEST_INDEX ?
                                 plugin.behaviors[BEHAVIOR_TEST_INDEX] : common.randomFromArray(plugin.behaviors);
      const {tweets, users} = await plugin.searchTweets(behavior)
                                 .catch(err => {
                                   plugin.logger.error(err);
                                   reject({ "message": "impossible de chercher des tweets", "status": 500});
                                 });
      if (tweets === undefined) {
        return;
      }
      const filteredTweets = tweets.filter(t => {
          return t.text && t.text.includes(behavior.search);
      });
      plugin.logger.info("choose a tweet from results q:" + behavior.search +
                         " results:" + tweets.length +
                         " filtered:" + filteredTweets.length);
      const tweetCandidate = common.randomFromArray(filteredTweets);
      if (tweetCandidate === undefined) {
          reject({ "message": "aucun candidat pour '" + behavior.search + "'", "status": 202});
          return;
      }
      const replyTweet = await plugin.replyTweet(doSimulate, tweetCandidate, users, behavior, pluginTags)
                                     .catch(err => {
                                       plugin.logger.error(err);
                                       reject({"message": "impossible de répondre au tweet", "status": 500});
                                     });
      if (replyTweet) {
          resolve({
              "html": "<b>Tweet</b>: <div class=\"bg-info\">" +
                  plugin.twitterAPIV2Service.tweetHtmlOf(tweetCandidate, users) + "</div>" +
                  "<b>Réponse émise</b>: " +
                  plugin.twitterAPIV2Service.tweetReplyHtmlOf(replyTweet),
              "text": "\nTweet:\n\t" +
                  plugin.twitterAPIV2Service.tweetLinkOf(tweetCandidate, users) + "\n\t" +
                  plugin.twitterAPIV2Service.tweetInfoOf(tweetCandidate, users) + "\n" +
                  "Reply sent:\n\t" +
                  plugin.twitterAPIV2Service.tweetReplyLinkOf(replyTweet) + "\n\t" +
                  plugin.twitterAPIV2Service.tweetReplyInfoOf(replyTweet) + "\n"
          });
      }
    });
  }

  searchTweets(behavior) {
    const plugin = this;
    const common = plugin.common;
    return new Promise(async function promise(resolve, reject) {
      const noRetweet = " (-is:retweet)";
      const fromMe = " (from:botEnTrain1)";
      const notMe = " (-from:botEnTrain1)";
      const searchQueryFromMe = "\"" + behavior.reply + "\"" + noRetweet + fromMe;
      var {tweets, users, rateLimit} = await plugin.twitterAPIV2Service.searchRecent(searchQueryFromMe, 100)
                                                     .catch(reject);
      if (tweets === undefined) {
        return;
      }
      const mentioned = plugin.twitterAPIV2Service.tweetsUserMentionsNames(tweets);
      if (common.arrayWithContent(mentioned)) {
        plugin.logger.debug("Exclude already mentioned users => " + mentioned.join(', '));
      }
      var searchQueryNotMe = "\"" + behavior.search + "\"" + noRetweet + notMe;
      mentioned.forEach(mentionedUser => {// exclude alreadyMentioned
          searchQueryNotMe += " -from:" + mentionedUser;
      });
      var {tweets, users, rateLimit} = await plugin.twitterAPIV2Service.searchRecent(searchQueryNotMe, 20)
                                                                      .catch(reject);
      if (tweets === undefined) {
        return;
      }
      resolve({tweets, users});
    });
  }

  replyTweet(doSimulate, tweet,  users, behavior, pluginTags, quoteTweet = null, quoteUsers = null) {
    let replyMessage = behavior.reply + "\n\n";
    if (behavior.credits) {
      replyMessage += behavior.credits + "\n";
    }
    replyMessage += behavior.link + "\n" + pluginTags;
    return this.twitterAPIV2Service.replyTo(tweet, users, replyMessage, doSimulate, quoteTweet, quoteUsers);
  }
}
