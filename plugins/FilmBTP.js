/*jshint esversion: 6 */
var log4js = require('log4js');

class FilmBTP {
  constructor(twitterClient) {
    this.logger = log4js.getLogger();
    this.logger.setLevel('INFO'); // DEBUG will show search results
    this.twitterClient = twitterClient;
    this.behaviors = [
        { "search":"est très fin",
          "reply":"C'est fin, c'est très fin, ça se mange sans faim.",
          "link":"https://www.youtube.com/watch?v=xa2A07mhG9g"
        }
    ];
  }

  getPluginTags() {
    return ["#BetFilm","#RepliquesDeFilms"];
  }

  isReady() {
    return true;
  }

  process(cb) {
    let behavior = this.behaviors[0];
    let tweets = this.searchTweets(behavior, (err, tweets) => {
        if (err) {
            this.logError(err);
            cb("unable to search tweet");
            return;
        }
        let debugLog = "";
        tweets.forEach((t) => {
            debugLog += "\n\t" + this.twitterClient.tweetLinkOf(t) + "\n\t\t" + this.twitterClient.tweetInfoOf(t);
        });
        this.logDebug("search results " + debugLog);
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
                cb("unable to reply tweet");
                return;
            }
            let successState = "Reply sent:" +
                this.twitterClient.tweetLinkOf(replyTweet) +
                this.twitterClient.tweetInfoOf(replyTweet);
            cb(false, successState);
        });
    });
  }

  searchTweets(behavior, cb) {
    this.twitterClient.search(behavior.search, 20, cb);
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