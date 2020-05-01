/*jshint esversion: 6 */
const log4js = require('log4js');

const PLANTNET_MINIMAL_PERCENT = 60;
const PLANTNET_MINIMAL_RATIO = PLANTNET_MINIMAL_PERCENT / 100;
const PLANTNET_SIMULATE = process.env.PLANTNET_SIMULATE || false;

class PlantnetBTP {
  constructor(twitterClient, plantnetClient) {
    this.isAvailable = false;
    this.logger = log4js.getLogger('PlantnetBTP');
    this.logger.setLevel('DEBUG'); // DEBUG will show search results
    this.twitterClient = twitterClient;
    this.plantnetClient = plantnetClient;
    try {
        this.isAvailable = plantnetClient.isReady();
        this.logger.info(this.isAvailable ? "available" : "not available");
    } catch (exception) {
        this.logger.error(exception);
    }
  }

  getName() {
    return "PlantnetBTP";
  }

  getPluginTags() {
    return ["#BetPlantnet","#IndentificationDePlantes"].join(' ');
  }

  isReady() {
    return this.isAvailable;
  }

  _debugTweet() {
      let tweetId = "11223344";
      this.twitterClient.getTweetDetails(tweetId, (err, data) => {
          this.logger.error(err);
          this.logger.info(data);
      });
  }

  process(doSimulate, cb) {
    // DEBUG // this._debugTweet(); return;

    let question = "(\"quelle est cette plante\" OR \"quelle est cette fleur\")";
    let noArbre = " -arbre";
    let withImage = " filter:media filter:images";
    let plantnetSearch = question + noArbre + withImage;
    this.searchTweets(plantnetSearch, (err, tweets) => {
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
        let tweetCandidate = this.randomFromArray(tweets);
        if (!tweetCandidate) {
            cb({ "message": "aucun candidat pour pl@ntnet",
                 "status": 202});
            return;
        }
        let candidateImage = this.twitterClient.tweetFirstMediaUrl(tweetCandidate);
        this.logger.debug("tweetCandidate : " +
            this.twitterClient.tweetLinkOf(tweetCandidate) + "\n\t" +
            this.twitterClient.tweetInfoOf(tweetCandidate) + "\n\t" +
            "first media url : " + candidateImage + "\n");

        if (!candidateImage) {
            cb({ "message": "aucune image pour pl@ntnet dans" + this.twitterClient.tweetLinkOf(tweetCandidate),
                 "status": 202});
            return;
        }
        this.logger.debug("candidateImage : " + candidateImage);

        this.plantnetClient.identify(candidateImage, PLANTNET_SIMULATE, (err, plantResult) => {
            if (err) {
                this.logger.error(err);
                cb({"message": "impossible d'identifier l'image", "status": 500});
                return;
            }

            // this.logger.debug("plantnetResult : " + JSON.stringify(plantResult));

            let firstScoredResult = this.plantnetClient.hasScoredResult(plantResult, PLANTNET_MINIMAL_RATIO);
            if (!firstScoredResult) {
                this.replyNoScoredResult(doSimulate, tweetCandidate, cb);
                return;
            }
            this.replyScoredResult(doSimulate, tweetCandidate, firstScoredResult, cb);

        }); // plantnetClient.identify end


    });
  }

  replyScoredResult(doSimulate, tweetCandidate, firstScoredResult, cb) {
    this.plantnetClient.resultImageOf(firstScoredResult, (illustrateImage) => {
      let replyMessage = "Pl@ntnet identifie " +
      this.plantnetClient.resultInfoOf(firstScoredResult) + "\n" +
      (illustrateImage ? "\n\n" + illustrateImage : "");

      this.replyTweet(doSimulate, tweetCandidate, replyMessage, (err, replyTweet) => {
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

  replyNoScoredResult(doSimulate, tweetCandidate, cb) {
      let replyMessage = "Bonjour, j'ai interrogé Pl@ntnet pour tenter d'identifier votre première image" +
      " mais cela n'a pas donné de résultat concluant (score>" + PLANTNET_MINIMAL_PERCENT + "%).\n:(\n";
      this.replyTweet(doSimulate, tweetCandidate, replyMessage, (err, replyTweet) => {
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
  }

  searchTweets(plantnetSearch, cb) {
    let plugin = this;
    let noRetweet = " -filter:retweets";
    let notMe = " -from:botEnTrain1";
    let extendedMode = true;
    plugin.logger.debug("get already mentioned users");
    plugin.twitterClient.getRecentlyMentionedUsers("botEnTrain1", 200, (err, mentionedUsers) => {
        if (err) {
            plugin.logger.warn("Unable to search mentioned users " + JSON.stringify(err));
            cb(err);
            return;
        }
        if (plugin.arrayWithContent(mentionedUsers)) {
          plugin.logger.debug("Exclude already mentioned users => " + mentionedUsers.join(', '));
        }
        let searchQueryNotMe = plantnetSearch + noRetweet + notMe;
        mentionedUsers.forEach((mentionedUser) => {// exclude alreadyMentioned
            searchQueryNotMe += " -from:" + mentionedUser;
        });
        plugin.twitterClient.search(searchQueryNotMe, 50, extendedMode, cb);
    });
  }

  replyTweet(doSimulate, tweet, message, cb) {
    let replyMessage = message + "\n\n" + this.getPluginTags();
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

module.exports = PlantnetBTP;