import log4js from 'log4js';
import fs     from 'fs';

const BEHAVIOR_TEST_INDEX = process.env.BEHAVIOR_TEST_INDEX || false;

export default class FilmBTP {

  constructor(twitterService) {
    this.isAvailable = false;
    this.logger = log4js.getLogger('FilmBTP');
    this.logger.level = "DEBUG"; // DEBUG will show search results
    this.twitterService = twitterService;
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

  isReady() {
    return this.isAvailable;
  }

  process(config) {
    const plugin = this;
    return new Promise(async function promise(resolve, reject) {
      const doSimulate = config.doSimulate || false;
      const behavior = BEHAVIOR_TEST_INDEX && plugin.behaviors.length > BEHAVIOR_TEST_INDEX ?
                                 plugin.behaviors[BEHAVIOR_TEST_INDEX] : plugin.randomFromArray(plugin.behaviors);
      const tweets = await plugin.searchTweets(behavior)
                                 .catch(err => {
                                   plugin.logger.error(err);
                                   reject({ "message": "impossible de chercher des tweets", "status": 500});
                                 });
      if (tweets === undefined) {
        return;
      }
      /*
      let debugLog = "";
      tweets.forEach((t) => {
          debugLog += "\n\t" + plugin.twitterService.tweetLinkOf(t) + "\n\t\t" + plugin.twitterService.tweetInfoOf(t);
          // debugLog += JSON.stringify(t) ;
      });
      plugin.logger.debug("search results " + debugLog);
      */
      const filteredTweets = tweets.filter(t => {
          return t.text && t.text.includes(behavior.search);
      });
      plugin.logger.info("choose a tweet from results q:" + behavior.search +
                         " results:" + tweets.length +
                         " filtered:" + filteredTweets.length);
      const tweetCandidate = plugin.randomFromArray(filteredTweets);
      if (tweetCandidate === undefined) {
          reject({ "message": "aucun candidat pour '" + behavior.search + "'", "status": 202});
          return;
      }
      const replyTweet = await plugin.replyTweet(doSimulate, tweetCandidate, behavior)
                                     .catch(err => {
                                       plugin.logger.error(err);
                                       reject({"message": "impossible de répondre au tweet", "status": 500});
                                     });
      if (replyTweet) {
          resolve({
              "html": "<b>Tweet</b>: <div class=\"bg-info\">" +
                  plugin.twitterService.tweetHtmlOf(tweetCandidate) + "</div>" +
                  "<b>Réponse émise</b>: " +
                  plugin.twitterService.tweetHtmlOf(replyTweet),
              "text": "\nTweet:\n\t" +
                  plugin.twitterService.tweetLinkOf(tweetCandidate) + "\n\t" +
                  plugin.twitterService.tweetInfoOf(tweetCandidate) + "\n" +
                  "Reply sent:\n\t" +
                  plugin.twitterService.tweetLinkOf(replyTweet) + "\n\t" +
                  plugin.twitterService.tweetInfoOf(replyTweet) + "\n"
          });
      }
    });
  }

  searchTweets(behavior) {
    const plugin = this;
    return new Promise(async function promise(resolve, reject) {
      const noRetweet = " -filter:retweets";
      const fromMe = " from:botEnTrain1";
      const notMe = " -from:botEnTrain1";
      const extendedMode = true;
      const searchQueryFromMe = "\"" + behavior.reply + "\"" + noRetweet + fromMe;
      const tweets = await plugin.twitterService.searchV1(searchQueryFromMe, 200, !extendedMode)
                                                .catch(reject);
      if (tweets === undefined) {
        return;
      }
      const mentioned = plugin.twitterService.tweetsUserMentionsNames(tweets);
      if (plugin.arrayWithContent(mentioned)) {
        plugin.logger.debug("Exclude already mentioned users => " + mentioned.join(', '));
      }
      var searchQueryNotMe = "\"" + behavior.search + "\"" + noRetweet + notMe;
      mentioned.forEach(mentionedUser => {// exclude alreadyMentioned
          searchQueryNotMe += " -from:" + mentionedUser;
      });
      const tweetsWithExclusions = await plugin.twitterService.searchV1(searchQueryNotMe, 20, !extendedMode)
                                                              .catch(reject);
      if (tweetsWithExclusions === undefined) {
        return;
      }
      resolve(tweetsWithExclusions);
    });
  }

  replyTweet(doSimulate, tweet, behavior) {
    let replyMessage = behavior.reply + "\n\n";
    if (behavior.credits) {
      replyMessage += behavior.credits + "\n";
    }
    replyMessage += behavior.link + "\n" + this.getPluginTags();
    return this.twitterService.replyTo(tweet, replyMessage, doSimulate);
  }

  randomFromArray(arr) {
    if (!Array.isArray(arr) || arr.length <= 0) {
        return undefined;
    }
    return arr[Math.floor(Math.random() * arr.length)];
  }

  arrayWithContent(arr) {
    return (Array.isArray(arr) && arr.length > 0);
  }
}
