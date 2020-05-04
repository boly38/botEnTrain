const log4js = require('log4js');
const fs = require('fs');

const PLANTNET_MINIMAL_PERCENT = 20;
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
        let questionsData = fs.readFileSync('plugins/data/questionsPlantnet.json');
        this.questions = JSON.parse(questionsData);
        this.isAvailable = plantnetClient.isReady();
        this.logger.info((this.isAvailable ? "available" : "not available") +
          " with " + this.questions.length + " questions");
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

  process(config, cb) {
    let pluginName = config.pluginName ? config.pluginName : this.getName();
    let pluginTags = config.pluginTags ? config.pluginTags : this.getPluginTags();
    let doSimulate = config.doSimulate || false;
    // DEBUG // this._debugTweet(); return;
    let allQuestions = "(\"" + this.questions.join("\" OR \"") + "\")" + " ?";
    let noArbre = " -arbre";
    let withImage = " filter:media filter:images";
    let plantnetSearch = allQuestions + noArbre + withImage;
    if (config.searchExtra) {
      plantnetSearch += " " + config.searchExtra;
    }
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
            cb({ "message": "aucun candidat pour " + pluginName,
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
                this.logger.error(err.message);
                if (err.status && err.status == 404) {
                    this.replyNotFoundResult(doSimulate, pluginTags, tweetCandidate, cb);
                    return;
                }
                cb({"message": "impossible d'identifier l'image",
                    "html": "<b>Tweet</b>: <div class=\"bg-warning\">" +
                    this.twitterClient.tweetHtmlOf(tweetCandidate) + "</div>" +
                    " <b>Erreur</b>: impossible d'identifier l'image",
                    "status": 500});
                return;
            }

            // this.logger.debug("plantnetResult : " + JSON.stringify(plantResult));

            let firstScoredResult = this.plantnetClient.hasScoredResult(plantResult, PLANTNET_MINIMAL_RATIO);
            if (!firstScoredResult) {
                this.replyNoScoredResult(doSimulate, pluginTags, tweetCandidate, cb);
                return;
            }
            this.replyScoredResult(doSimulate, pluginTags, tweetCandidate, firstScoredResult, cb);

        }); // plantnetClient.identify end


    });
  }

  replyScoredResult(doSimulate, pluginTags, tweetCandidate, firstScoredResult, cb) {
    this.plantnetClient.resultImageOf(firstScoredResult, (illustrateImage) => {
      let replyMessage = "Pl@ntnet identifie " +
      this.plantnetClient.resultInfoOf(firstScoredResult) + "\n" +
      (illustrateImage ? "\n\n" + illustrateImage : "") + "\n\n" +
      pluginTags;

      this.replyResult(doSimulate, tweetCandidate, replyMessage, cb);
    });
  }

  replyNotFoundResult(doSimulate, pluginTags, tweetCandidate, cb) {
      let replyMessage = "Bonjour, j'ai interrogé Pl@ntnet pour tenter d'identifier votre première image" +
      " mais a priori il ne s'agit ni d'une plante ni d'une fleur 😏 ?\n" +
      "Je me suis bien fait avoir 😊 !\n\n" +
      pluginTags;
      this.replyResult(doSimulate, tweetCandidate, replyMessage, cb);
   }

  replyNoScoredResult(doSimulate, pluginTags, tweetCandidate, cb) {
      let replyMessage = "Bonjour, j'ai interrogé Pl@ntnet pour tenter d'identifier votre première image" +
      " mais cela n'a pas donné de résultat concluant 😩 (score>" + PLANTNET_MINIMAL_PERCENT + "%).\n" +
      "Astuce: bien cadrer la fleur ou feuille\n\n" +
      pluginTags;
      this.replyResult(doSimulate, tweetCandidate, replyMessage, cb);
  }

  replyResult(doSimulate, tweetCandidate, replyMessage, cb) {
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

        let searchQueryNotMe = plantnetSearch + noRetweet + notMe;
        plugin.twitterClient.search(searchQueryNotMe, 50, extendedMode, (err, tweets) => {
            if (err) {
                cb(err);
                return;
            }
            let filteredTweets = tweets;
            if (plugin.arrayWithContent(tweets) && plugin.arrayWithContent(mentionedUsers)) {
              filteredTweets = plugin.filterMentionedUsers(tweets, mentionedUsers);
              plugin.logger.debug("Exclude " + (tweets.length - filteredTweets.length) +
               " already mentioned users => " + mentionedUsers.join(', '));
            }
            cb(false, filteredTweets);
        });
    });
  }

  replyTweet(doSimulate, tweet, replyMessage, cb) {
    this.twitterClient.replyTo(tweet, replyMessage, doSimulate, cb);
  }

  filterMentionedUsers(tweets, usersToFilter) {
    if (!tweets) {
      return [];
    }
    return tweets.filter((t) => {
        let tweetAuthor = t.user ? t.user.screen_name : false;
        return tweetAuthor && !usersToFilter.includes(tweetAuthor);
    });
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