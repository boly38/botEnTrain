/*jshint esversion: 6 */
const log4js = require('log4js');

const PLANTNET_MINIMAL_PERCENT = 60;
const PLANTNET_MINIMAL_RATIO = PLANTNET_MINIMAL_PERCENT / 100;

class PlantnetBTP {
  constructor(twitterClient, plantnetClient) {
    this.isAvailable = false;
    this.logger = log4js.getLogger();
    this.logger.setLevel('DEBUG'); // DEBUG will show search results
    this.twitterClient = twitterClient;
    this.plantnetClient = plantnetClient;
    try {
        this.isAvailable = plantnetClient.isReady();
        this.logInfo(this.isAvailable ? "available" : "not available");
    } catch (exception) {
        this.logError(exception);
    }
  }

  getName() {
    return "PlantnetBTP";
  }

  getPluginTags() {
    return ["#BetPlantnet","#IndentificationDePlantes"];
  }

  isReady() {
    return this.isAvailable;
  }

  process(doSimulate, cb) {
    let question = "(\"quelle est cette plante\" OR \"quelle est cette fleur\")";
    let noArbre = " -arbre";
    let withImage = " filter:media filter:images";
    let plantnetSearch = question + noArbre + withImage;
    this.searchTweets(plantnetSearch, (err, tweets) => {
        if (err) {
            this.logError(err);
            cb({ "message": "impossible de chercher des tweets", "status": 500});
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
        let tweetCandidate = this.randomFromArray(tweets);
        if (!tweetCandidate) {
            cb({ "message": "aucun candidat pour pl@ntnet",
                 "status": 202});
            return;
        }
        let candidateImage = this.twitterClient.tweetFirstMediaUrl(tweetCandidate);
        this.logDebug("tweetCandidate : " +
            this.twitterClient.tweetLinkOf(tweetCandidate) + "\n\t" +
            this.twitterClient.tweetInfoOf(tweetCandidate) + "\n\t" +
            "first media url : " + candidateImage + "\n");

        if (!candidateImage) {
            cb({ "message": "aucune image pour pl@ntnet dans" + this.twitterClient.tweetLinkOf(tweetCandidate),
                 "status": 202});
            return;
        }
        this.logDebug("candidateImage : " + candidateImage);

        this.plantnetClient.identify(candidateImage, doSimulate, (err, plantResult) => {
            if (err) {
                this.logError(err);
                cb({"message": "impossible d'identifier l'image", "status": 500});
                return;
            }

            // this.logDebug("plantnetResult : " + JSON.stringify(plantResult));

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
      let illustrateImage = this.plantnetClient.resultImageOf(firstScoredResult);
      let replyMessage = "Bonjour, j'ai interrogé Pl@ntnet pour tenter d'identifier votre première image" +
      " et voici en résultat : \n" +
      this.plantnetClient.resultInfoOf(firstScoredResult) + "\n" +
      (illustrateImage ? "Avec en illustration: " + illustrateImage : "");

      this.replyTweet(doSimulate, tweetCandidate, replyMessage, (err, replyTweet) => {
          if (err) {
              this.logError(err);
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

  replyNoScoredResult(doSimulate, tweetCandidate, cb) {
      let replyMessage = "Bonjour, j'ai interrogé Pl@ntnet pour tenter d'identifier votre première image" +
      " mais cela n'a pas donné de résultat concluant (score>" + PLANTNET_MINIMAL_PERCENT + "%).\n:(\n";
      this.replyTweet(doSimulate, tweetCandidate, replyMessage, (err, replyTweet) => {
          if (err) {
              this.logError(err);
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
    let fromMe = " from:botEnTrain1";
    let notMe = " -from:botEnTrain1";
    let searchQueryFromMe = this.getPluginTags()[0] + noRetweet + fromMe;
    let extendedMode = true;
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
              plugin.logDebug("Exclude already mentioned users => " + mentioned.join(', '));
            }
        }
        let searchQueryNotMe = plantnetSearch + noRetweet + notMe;
        mentioned.forEach((mentionedUser) => {// exclude alreadyMentioned
            searchQueryNotMe += " -from:" + mentionedUser;
        });
        plugin.twitterClient.search(searchQueryNotMe, 20, extendedMode, cb);
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

module.exports = PlantnetBTP;