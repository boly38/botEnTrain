/*jshint esversion: 6 */
const log4js = require('log4js');
const fs = require('fs');

class FilmBTP {
  constructor(twitterClient) {
    this.isAvailable = false;
    this.logger = log4js.getLogger();
    this.logger.setLevel('DEBUG'); // DEBUG will show search results
    this.twitterClient = twitterClient;
    try {
        let behaviorsData = fs.readFileSync('plugins/data/filmBtp.json');
        this.behaviors = JSON.parse(behaviorsData);
        this.isAvailable = true;
        this.logInfo("available with " + this.behaviors.length + " behaviors");
    } catch (exception) {
        this.logError(exception);
    }
  }

  getPluginTags() {
    return ["#BetFilm","#RepliquesDeFilms"];
  }

  isReady() {
    return this.isAvailable;
  }

  process(cb) {
    let behavior = this.randomFromArray(this.behaviors);
    let tweets = this.searchTweets(behavior, (err, tweets) => {
        if (err) {
            this.logError(err);
            cb("impossible de chercher des tweets");
            return;
        }
        /*
        let debugLog = "";
        tweets.forEach((t) => {
            debugLog += "\n\t" + this.twitterClient.tweetLinkOf(t) + "\n\t\t" + this.twitterClient.tweetInfoOf(t);
            // debugLog += JSON.stringify(t) ;
        });
        this.logDebug("search results " + debugLog);
        */
        let filteredTweets = tweets.filter((t) => {
            return t.text && t.text.includes(behavior.search);
        });
        this.logInfo("choose a tweet from results q:" + behavior.search +
         " results:" + tweets.length +
         " filtered:" + filteredTweets.length);
        let tweetCandidate = this.randomFromArray(filteredTweets);
        if (!tweetCandidate) {
            cb("no candidate");
            return;
        }
        this.replyTweet(tweetCandidate, behavior, (err, replyTweet) => {
            if (err) {
                this.logError(err);
                cb("impossible de répondre au tweet");
                return;
            }
            cb(false, {
                "html": "<b>Tweet</b>: " +
                    this.twitterClient.tweetHtmlOf(tweetCandidate) +
                    "<br><b>Réponse émise</b>:" +
                    this.twitterClient.tweetHtmlOf(replyTweet),
                "text": "\nTweet:\n\t" +
                    this.twitterClient.tweetLinkOf(tweetCandidate) + "\n\t" +
                    this.twitterClient.tweetInfoOf(tweetCandidate) + "\n" +
                    "Reply sent:\n\t" +
                    this.twitterClient.tweetLinkOf(replyTweet) + "\n\t" +
                    this.twitterClient.tweetInfoOf(replyTweet) + "\n"
            });
        });
    });
  }

  searchTweets(behavior, cb) {
    let plugin = this;
    let noRetweet = " -filter:retweets";
    let fromMe = " from:botEnTrain1";
    let notMe = " -from:botEnTrain1";
    let searchQueryFromMe = "\"" + behavior.search + "\"" + noRetweet + fromMe;
    plugin.twitterClient.search(searchQueryFromMe, 200, (err,tweets) => {
        let mentioned = [];
        if (!err) {// get already mentioned users
            tweets.forEach((t) => {
                if (!t.entities || !t.entities.user_mentions) {
                  return;
                }
                t.entities.user_mentions.forEach((mention) => {
                    mentioned.push(mention.screen_name);
                });
            });
            plugin.logDebug("Exclude already mentioned users => " + mentioned.join(', '));
        }
        let searchQueryNotMe = "\"" + behavior.search + "\"" + noRetweet + notMe;
        mentioned.forEach((mentionedUser) => {// exclude alreadyMentioned
            searchQueryNotMe += " -from:" + mentionedUser;
        });
        plugin.twitterClient.search(searchQueryNotMe, 20, cb);
    });
  }

  replyTweet(tweet, behavior, cb) {
    let replyMessage = behavior.reply + "\n" +
    behavior.link + "\n" +
    this.getPluginTags();
    this.twitterClient.replyTo(tweet, replyMessage, cb);
  }

  randomFromArray(arr) {
    if (!Array.isArray(arr) || arr.length <= 0) {
        return undefined;
    }
    return arr[Math.floor(Math.random() * arr.length)];
  }

  logDebug(msg) {
    this.logger.debug(this.getPluginTags() + " | " + msg);
  }
  logInfo(msg) {
    this.logger.info(this.getPluginTags() + " | " + msg);
  }
  logError(msg) {
    this.logger.error(this.getPluginTags() + " | " + msg);
  }
}

module.exports = FilmBTP;