import log4js from 'log4js';
import fs from 'fs';

const PLANTNET_MINIMAL_PERCENT = 20;
const PLANTNET_MINIMAL_RATIO = PLANTNET_MINIMAL_PERCENT / 100;
const PLANTNET_SIMULATE = process.env.PLANTNET_SIMULATE || false;

export default class PlantnetBTP {
  constructor(twitterService, plantnetService) {
    this.isAvailable = false;
    this.logger = log4js.getLogger('PlantnetBTP');
    this.logger.level = "DEBUG"; // DEBUG will show search results
    this.twitterService = twitterService;
    this.plantnetService = plantnetService;
    try {
        let questionsData = fs.readFileSync('src/data/questionsPlantnet.json');
        this.questions = JSON.parse(questionsData);
        this.isAvailable = plantnetService.isReady();
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
      this.twitterService.getTweetDetails(tweetId, (err, data) => {
          this.logger.error(err);
          this.logger.info(data);
      });
  }

  process(config) {
    const plugin = this;
    return new Promise(async function(resolve, reject) {
      const pluginName = config.pluginName ? config.pluginName : plugin.getName();
      const pluginTags = config.pluginTags ? config.pluginTags : plugin.getPluginTags();
      const doSimulate = config.doSimulate || false;
      // DEBUG // this._debugTweet(); return;
      const allQuestions = "(\"" + plugin.questions.join("\" OR \"") + "\")" + " ?";
      const noArbre = " -arbre";
      const withImage = " filter:media filter:images";
      var plantnetSearch = allQuestions + noArbre + withImage;
      if (config.searchExtra) {
        plantnetSearch += " " + config.searchExtra;
      }
      const tweets = await plugin.searchTweets(plantnetSearch)
                                 .catch( err => {
                                   plugin.logger.error(err);
                                   reject({ "message": "impossible de chercher des tweets", "status": 500});
                                 });
      if (tweets === undefined) {
        return;
      }

      //this._debugLogTweets(tweets);
      const tweetCandidate = plugin.randomFromArray(tweets);
      if (!tweetCandidate) {
          reject({ "message": "aucun candidat pour " + pluginName, "status": 202});
          return;
      }
      const candidateImage = plugin.twitterService.tweetFirstMediaUrl(tweetCandidate);
      plugin.logger.debug("tweetCandidate : " +
          plugin.twitterService.tweetLinkOf(tweetCandidate) + "\n\t" +
          plugin.twitterService.tweetInfoOf(tweetCandidate) + "\n\t" +
          "first media url : " + candidateImage + "\n");

      if (!candidateImage) {
          reject({ "message": "aucune image pour pl@ntnet dans" + plugin.twitterService.tweetLinkOf(tweetCandidate), "status": 202});
          return;
      }
      plugin.logger.debug("candidateImage : " + candidateImage);

      plugin.plantnetService.identify(candidateImage, PLANTNET_SIMULATE, (err, plantResult) => {
          if (err) {
              plugin.logger.error(err.message);
              if (err.status && err.status == 404) {
                  plugin.replyNotFoundResult(doSimulate, pluginTags, tweetCandidate, cb);
                  return;
              }
              reject({"message": "impossible d'identifier l'image",
                  "html": "<b>Tweet</b>: <div class=\"bg-warning\">" +
                  plugin.twitterService.tweetHtmlOf(tweetCandidate) + "</div>" +
                  " <b>Erreur</b>: impossible d'identifier l'image",
                  "status": 500});
              return;
          }

          // plugin.logger.debug("plantnetResult : " + JSON.stringify(plantResult));

          const firstScoredResult = plugin.plantnetService.hasScoredResult(plantResult, PLANTNET_MINIMAL_RATIO);
          if (!firstScoredResult) {
              plugin.replyNoScoredResult(doSimulate, pluginTags, tweetCandidate).catch(reject).then(resolve);
              return;
          }
          plugin.replyScoredResult(doSimulate, pluginTags, tweetCandidate, firstScoredResult).catch(reject).then(resolve);

      }); // plantnetService.identify end

    });
  }

  _debugLogTweets(tweets) {
      let debugLog = "";
      tweets.forEach((t) => {
          debugLog += "\n\t" + this.twitterService.tweetLinkOf(t) + "\n\t\t" + this.twitterService.tweetInfoOf(t);
          // debugLog += JSON.stringify(t) ;
      });
      this.logger.debug("tweets " + debugLog);
  }

  replyScoredResult(doSimulate, pluginTags, tweetCandidate, firstScoredResult) {
    const plugin = this;
    return new Promise(async function(resolve, reject) {
      plugin.plantnetService.resultImageOf(firstScoredResult, (illustrateImage) => {
        let replyMessage = "Pl@ntnet identifie " +
        plugin.plantnetService.resultInfoOf(firstScoredResult) + "\n" +
        (illustrateImage ? "\n\n" + illustrateImage : "") + "\n\n" +
        pluginTags;

        plugin.replyResult(doSimulate, tweetCandidate, replyMessage).catch(reject).then(resolve);
      });
    });

  }

  replyNotFoundResult(doSimulate, pluginTags, tweetCandidate) {
      const replyMessage = "Bonjour, j'ai interrogé Pl@ntnet pour tenter d'identifier votre première image" +
      " mais a priori il ne s'agit ni d'une plante ni d'une fleur 😏 ?\n" +
      "Je me suis bien fait avoir 😊 !\n\n" +
      pluginTags;
      return this.replyResult(doSimulate, tweetCandidate, replyMessage);
   }

  replyNoScoredResult(doSimulate, pluginTags, tweetCandidate) {
      const replyMessage = "Bonjour, j'ai interrogé Pl@ntnet pour tenter d'identifier votre première image" +
      " mais cela n'a pas donné de résultat concluant 😩 (score>" + PLANTNET_MINIMAL_PERCENT + "%).\n" +
      "Astuce: bien cadrer la fleur ou feuille\n\n" +
      pluginTags;
      return this.replyResult(doSimulate, tweetCandidate, replyMessage);
  }

  replyResult(doSimulate, tweetCandidate, replyMessage) {
    const plugin = this;
    return new Promise(async function(resolve, reject) {
      const replyTweet = await plugin.replyTweet(doSimulate, tweetCandidate, replyMessage)
                                     .catch( err => {
                                         plugin.logger.error(err);
                                         reject({"message": "impossible de répondre au tweet", "status": 500});
                                     });
      if (replyTweet !== undefined) {
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

  searchTweets(plantnetSearch) {
    const plugin = this;
    return new Promise(async function(resolve, reject) {
      const noRetweet = " -filter:retweets";
      const notMe = " -from:botEnTrain1";
      const extendedMode = true;
      plugin.logger.debug("get recent answers");
      const recentAnswersIds = await plugin.twitterService.getRecentlyAnsweredStatuses("botEnTrain1", 200)
                                           .catch(err => {
                                              plugin.logger.warn("Unable to search recent answers " + JSON.stringify(err));
                                              reject(err);
                                           });
      const searchQueryNotMe = plantnetSearch + noRetweet + notMe;
      const tweets = await plugin.twitterService.searchV1(searchQueryNotMe, 50, extendedMode)
                                 .catch( err => {
                                   reject(err);
                                 });
      var filteredTweets = tweets;
      if (plugin.arrayWithContent(tweets) && plugin.arrayWithContent(recentAnswersIds)) {
        filteredTweets = plugin.filterRecentAnswers(tweets, recentAnswersIds);
        plugin.logger.debug("Exclude " + (tweets.length - filteredTweets.length));
      }
      resolve(filteredTweets);
    });
  }

  replyTweet(doSimulate, tweet, replyMessage) {
    return this.twitterService.replyTo(tweet, replyMessage, doSimulate);
  }

  filterRecentAnswers(tweets, recentAnswersIds) {
    if (!tweets) {
      return [];
    }
    return tweets.filter((t) => {
        return !recentAnswersIds.includes(t.id_str);
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
