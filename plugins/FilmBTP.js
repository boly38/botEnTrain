/*jshint esversion: 6 */
const log4js = require('log4js');
const fs = require('fs');

class FilmBTP {
  constructor(twitterClient) {
    this.isAvailable = false;
    this.logger = log4js.getLogger('FilmBTP');
    this.logger.setLevel('DEBUG'); // DEBUG will show search results
    this.twitterClient = twitterClient;
    try {
        let behaviorsData = fs.readFileSync('plugins/data/filmBtp.json');
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

  process(doSimulate, cb) {
    let behavior = this.randomFromArray(this.behaviors);
    let tweets = this.searchTweets(behavior, (err, tweets) => {
        if (err) {
            this.logger.error(err);
            cb({ "message": "impossible de chercher des tweets", "status": 500});
            return;
        }
        /*
        let debugLog = "";
        tweets.forEach((t) => {
            debugLog += "\n\t" + this.twitterClient.tweetLinkOf(t) + "\n\t\t" + this.twitterClient.tweetInfoOf(t);
            // debugLog += JSON.stringify(t) ;
        });
        this.logger.debug("search results " + debugLog);
        */
        let filteredTweets = tweets.filter((t) => {
            return t.text && t.text.includes(behavior.search);
        });
        this.logger.info("choose a tweet from results q:" + behavior.search +
         " results:" + tweets.length +
         " filtered:" + filteredTweets.length);
        let tweetCandidate = this.randomFromArray(filteredTweets);
        if (!tweetCandidate) {
            cb({ "message": "aucun candidat pour '" + behavior.search + "'",
                 "status": 202});
            return;
        }
        this.replyTweet(doSimulate, tweetCandidate, behavior, (err, replyTweet) => {
            if (err) {
                this.logger.error(err);
                cb({"message": "impossible de répondre au tweet", "status": 500});
                return;
            }
            cb(false, {
                "html": "<b>Tweet</b>: <div class=\"bg-info\">" +
                    this.twitterClient.tweetHtmlOf(tweetCandidate) + "</div>" +
                    "<b>Réponse émise</b>: " +
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
    let extendedMode = true;
    let searchQueryFromMe = "\"" + behavior.reply + "\"" + noRetweet + fromMe;
    plugin.twitterClient.search(searchQueryFromMe, 200, !extendedMode, (err,tweets) => {
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
            if (plugin.arrayWithContent(mentioned)) {
              plugin.logger.debug("Exclude already mentioned users => " + mentioned.join(', '));
            }
        }
        let searchQueryNotMe = "\"" + behavior.search + "\"" + noRetweet + notMe;
        mentioned.forEach((mentionedUser) => {// exclude alreadyMentioned
            searchQueryNotMe += " -from:" + mentionedUser;
        });
        plugin.twitterClient.search(searchQueryNotMe, 20, !extendedMode, cb);
    });
  }

  replyTweet(doSimulate, tweet, behavior, cb) {
    let replyMessage = behavior.reply + "\n\n";
    if (behavior.credits) {
      replyMessage += behavior.credits + "\n";
    }
    replyMessage += behavior.link + "\n" + this.getPluginTags();
    this.twitterClient.replyTo(tweet, replyMessage, doSimulate, cb);
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

module.exports = FilmBTP;