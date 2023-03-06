import log4js from 'log4js';
import fs from 'fs';

const PLANTNET_MINIMAL_PERCENT = 20;
const PLANTNET_MINIMAL_RATIO = PLANTNET_MINIMAL_PERCENT / 100;

export default class PlantnetBTP {
  constructor(config, twitterAPIV2Service, plantnetService) {
    this.isAvailable = false;
    this.logger = log4js.getLogger('PlantnetBTP');
    this.logger.level = "INFO"; // DEBUG will show search results
    this.twitterV2Service = twitterAPIV2Service;
    this.plantnetSimulate = (config.bot.plantnetSimulate === true);
    this.plantnetService = plantnetService;
    try {
        let questionsData = fs.readFileSync('src/data/questionsPlantnet.json');
        this.questions = JSON.parse(questionsData);
        this.isAvailable = plantnetService.isReady();
        this.logger.info((this.isAvailable ? "available" : "not available") +
          " with " + this.questions.length + " questions");
    } catch (exception) {
        this.logError("init", exception);
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
      this.twitterV2Service.getTweetDetails(tweetId, (err, data) => {
          this.logError("_debugTweet::getTweetDetails",err);
          this.logger.info(data);
      });
  }

  process(config) {
    const plugin = this;
    var { pluginName, pluginTags, doSimulate } = config;
    if (config.pluginName === undefined || config.pluginTags === undefined) {
      pluginName = plugin.getName();
      pluginTags = plugin.getPluginTags();
    }
    doSimulate = (config.doSimulate === true);

    return new Promise(async function(resolve, reject) {
      // DEBUG // this._debugTweet(); return;
      const allQuestions = "(\"" + plugin.questions.join("\" OR \"") + "\")" + " \"?\"";
      const noArbre = " -arbre";
      const withImage = " (has:media) (has:images)";
      var plantnetSearch = allQuestions + noArbre + withImage;
      if (config.searchExtra) {
        plantnetSearch += " " + config.searchExtra;
      }
      const {tweets, medias, users} = await plugin.searchTweets(plantnetSearch)
                                 .catch( err => {
                                   plugin.logError("searchTweets",{plantnetSearch, err});
                                   reject({ "message": "impossible de chercher des tweets", "status": 500});
                                 });
      if (tweets === undefined) {
        return;
      }

      //this._debugLogTweets(tweets, users);
      const tweetCandidate = plugin.randomFromArray(tweets);
      if (!tweetCandidate) {
          plugin.logger.info("no candidate for " + pluginName );
          reject({ "message": "aucun candidat pour " + pluginName, "status": 202});
          return;
      }
      const candidatePhoto = plugin.twitterV2Service.tweetFirstPhotoMedia(tweetCandidate, medias);
      const candidateImage = candidatePhoto?.url;
      plugin.logger.debug("tweetCandidate : " +
          plugin.twitterV2Service.tweetLinkOf(tweetCandidate, users) + "\n\t" +
          plugin.twitterV2Service.tweetInfoOf(tweetCandidate, users) + "\n\t" +
          "first media url : " + candidateImage + "\n");

      if (!candidateImage) {
          plugin.logger.info("no candidate image");
          reject({ "message": "aucune image pour pl@ntnet dans" + plugin.twitterV2Service.tweetLinkOf(tweetCandidate, users), "status": 202});
          return;
      }
      plugin.logger.debug("candidateImage : " + candidateImage);

      plugin.plantnetService.identify(candidateImage, plugin.plantnetSimulate, (err, plantResult) => {
          if (err) {
              plugin.logError("plantnetService.identify", {candidateImage, "plantnetSimulate": plugin.plantnetSimulate, err});
              if (err.status && err.status == 404) {
                  plugin.replyNotFoundResult(doSimulate, pluginTags, tweetCandidate, users).catch(reject).then(resolve);
                  return;
              }
              reject({"message": "impossible d'identifier l'image",
                  "html": "<b>Tweet</b>: <div class=\"bg-warning\">" +
                  plugin.twitterV2Service.tweetHtmlOf(tweetCandidate, users) + "</div>" +
                  " <b>Erreur</b>: impossible d'identifier l'image",
                  "status": 500});
              return;
          }

          // plugin.logger.debug("plantnetResult : " + JSON.stringify(plantResult));

          const firstScoredResult = plugin.plantnetService.hasScoredResult(plantResult, PLANTNET_MINIMAL_RATIO);
          if (!firstScoredResult) {
              plugin.replyNoScoredResult(doSimulate, pluginTags, tweetCandidate, users).catch(reject).then(resolve);
              return;
          }
          plugin.replyScoredResult(doSimulate, pluginTags, tweetCandidate, users, firstScoredResult).catch(reject).then(resolve);

      }); // plantnetService.identify end

    });
  }

  _debugLogTweets(tweets, users) {
      let debugLog = "";
      tweets.forEach((t) => {
          debugLog += "\n\t" + this.twitterV2Service.tweetLinkOf(t, users) + "\n\t\t" + this.twitterV2Service.tweetInfoOf(t, users);
          // debugLog += JSON.stringify(t) ;
      });
      this.logger.debug("tweets " + debugLog);
  }

  replyScoredResult(doSimulate, pluginTags, tweetCandidate, users, firstScoredResult) {
    const plugin = this;
    return new Promise(async function(resolve, reject) {
      plugin.plantnetService.resultImageOf(firstScoredResult, (illustrateImage) => {
        let replyMessage = "Pl@ntnet identifie " +
        plugin.plantnetService.resultInfoOf(firstScoredResult) + "\n" +
        (illustrateImage ? "\n\n" + illustrateImage : "") + "\n\n" +
        pluginTags;

        plugin.replyResult(doSimulate, tweetCandidate, users, replyMessage).catch(reject).then(resolve);
      });
    });

  }

  replyNotFoundResult(doSimulate, pluginTags, tweetCandidate, users) {
      const replyMessage = "Bonjour, j'ai interrogé Pl@ntnet pour tenter d'identifier votre première image" +
      " mais a priori il ne s'agit ni d'une plante ni d'une fleur 😏 ?\n" +
      "Je me suis bien fait avoir 😊 !\n\n" +
      pluginTags;
      return this.replyResult(doSimulate, tweetCandidate, users, replyMessage);
   }

  replyNoScoredResult(doSimulate, pluginTags, tweetCandidate, users) {
      const replyMessage = "Bonjour, j'ai interrogé Pl@ntnet pour tenter d'identifier votre première image" +
      " mais cela n'a pas donné de résultat concluant 😩 (score>" + PLANTNET_MINIMAL_PERCENT + "%).\n" +
      "Astuce: bien cadrer la fleur ou feuille\n\n" +
      pluginTags;
      return this.replyResult(doSimulate, tweetCandidate, users, replyMessage);
  }

  replyResult(doSimulate, tweetCandidate,  users, replyMessage) {
    const plugin = this;
    plugin.logger.info("reply result", JSON.stringify({doSimulate, tweetCandidate, replyMessage},null,2));
    return new Promise(async function(resolve, reject) {
      const replyTweet = await plugin.replyTweet(doSimulate, tweetCandidate,  users, replyMessage)
                                     .catch( err => {
                                         plugin.logError("replyTweet", {err, doSimulate, tweetCandidate,  users, replyMessage});
                                         reject({"message": "impossible de répondre au tweet", "status": 500});
                                     });
      if (replyTweet !== undefined) {
          resolve({
              "html": "<b>Tweet</b>: <div class=\"bg-info\">" +
                  plugin.twitterV2Service.tweetHtmlOf(tweetCandidate, users) + "</div>" +
                  "<b>Réponse émise</b>: " +
                  plugin.twitterV2Service.tweetReplyHtmlOf(replyTweet),
              "text": "\nTweet:\n\t" +
                  plugin.twitterV2Service.tweetLinkOf(tweetCandidate, users) + "\n\t" +
                  plugin.twitterV2Service.tweetInfoOf(tweetCandidate, users) + "\n" +
                  "Reply sent:\n\t" +
                  plugin.twitterV2Service.tweetReplyLinkOf(replyTweet) + "\n\t" +
                  plugin.twitterV2Service.tweetReplyInfoOf(replyTweet) + "\n"
          });
      }
    });
  }

  searchTweets(plantnetSearch) {
    const plugin = this;
    return new Promise(async function(resolve, reject) {
      const botEnTrainId = '1254020717710053376';
      const noRetweet = " (-is:retweet)";
      const notMe = " (-from:botEnTrain1)";
      plugin.logger.debug("get recent answers");
      const recentAnswersIds = await plugin.twitterV2Service.getRecentlyAnsweredStatuses(botEnTrainId, 100)// valid range : 5..100
                                           .catch(err => {
                                              plugin.logError("twitterV2Service.getRecentlyAnsweredStatuses", {botEnTrainId, err});
                                              reject("Unable to search tweets");
                                           });
      if (recentAnswersIds === undefined) {
        return;
      }
      const searchQueryNotMe = plantnetSearch + noRetweet + notMe;
      var {tweets, users, medias, rateLimit} = await plugin.twitterV2Service.searchRecent(searchQueryNotMe, 50)
                                                   .catch( err => {
                                                     plugin.logError("twitterV2Service.searchRecent", {searchQueryNotMe, err});
                                                     reject("Unable to search tweets");
                                                   });
      if (tweets === undefined) {
        return;
      }
      var filteredTweets = tweets;
      if (plugin.arrayWithContent(tweets) && plugin.arrayWithContent(recentAnswersIds)) {
        filteredTweets = plugin.filterRecentAnswers(tweets, recentAnswersIds);
        plugin.logger.debug("Exclude " + (tweets.length - filteredTweets.length));
      }
      resolve({"tweets":filteredTweets, users, medias});
    });
  }

  replyTweet(doSimulate, tweet,  users, replyMessage) {
    return this.twitterV2Service.replyTo(tweet, users, replyMessage, doSimulate);
  }

  filterRecentAnswers(tweets, recentAnswersIds) {
    if (!tweets) {
      return [];
    }
    return tweets.filter(t => {
        return !recentAnswersIds.includes(t.id);
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

  logError(action, err) {
    if (Object.keys(err) && Object.keys(err).length > 0) {
      this.logger.error(action, JSON.stringify(err, null, 2));
      return;
    }
    this.logger.error(action, err);
  }
}
