import log4js from 'log4js';
import fs from 'fs';

const PLANTNET_MINIMAL_PERCENT = 20;
const PLANTNET_MINIMAL_RATIO = PLANTNET_MINIMAL_PERCENT / 100;

export default class PlantnetBTP {
  constructor(config, common, twitterAPIV2Service, plantnetService) {
    this.isAvailable = false;
    this.logger = log4js.getLogger('PlantnetBTP');
    this.logger.level = "INFO"; // DEBUG will show search results
    this.common = common;
    this.twitterAPIV2Service = twitterAPIV2Service;
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

  getQuestions() {
    return this.common.clone(this.questions);
  }

  isReady() {
    return this.isAvailable;
  }

  _debugTweet() {
      let tweetId = "11223344";
      this.twitterAPIV2Service.getTweetDetails(tweetId, (err, data) => {
          this.logError("_debugTweet::getTweetDetails",err);
          this.logger.info(data);
      });
  }

  plantnetIdentify(options) {
    const plugin = this;
    const {image, doSimulate, candidate, order, tags} = options;
    const plantnetSimulate = plugin.plantnetSimulate;

    return new Promise(async function(resolve, reject) {
      const plantResult = await plugin.plantnetService.identify({ "imageUrl": image, "doSimulate": plantnetSimulate })
              .catch( err => {
                plugin.logError("plantnetService.identify", {image, plantnetSimulate, err});
                if (err.status && err.status == 404) {
                    plugin.replyNotFoundResult(options).catch(reject).then(resolve);
                }
                reject({"message": "impossible d'identifier l'image",
                    "html": "<b>Tweet</b>: <div class=\"bg-warning\">" +
                    plugin.twitterAPIV2Service.tweetHtmlOf(candidate.tweet, candidate.users) + "</div>" +
                    " <b>Erreur</b>: impossible d'identifier l'image",
                    "status": 500});
              });
      if (plantResult === undefined) {
        return;
      }

      plugin.logger.debug("plantnetResult : " + JSON.stringify(plantResult));
      const firstScoredResult = plugin.plantnetService.hasScoredResult(plantResult, PLANTNET_MINIMAL_RATIO);
      if (!firstScoredResult) {
          plugin.replyNoScoredResult(options).catch(reject).then(resolve);
          return;
      }
      plugin.replyScoredResult(options, firstScoredResult).catch(reject).then(resolve);

   });

  }

  candidateMatch(candidate) {
    const plugin = this;
    const common = plugin.common;
    const candidateText = candidate?.tweet?.text;
    if (!candidateText) {
      plugin.logger.debug("!candidateText", candidateText);
      return false;
    }

    const matchQuestions = common.clone(plugin.questions).filter(q => candidateText.includes(q));
    plugin.logger.debug("matchQuestions", matchQuestions, "candidateText", candidateText);
    if (matchQuestions.length < 1) {
      return false;
    }
    const candidatePhoto = plugin.twitterAPIV2Service.tweetFirstPhotoMedia(candidate.tweet, candidate.medias);
    candidate.candidateImage = candidatePhoto?.url;
    // plugin.logger.debug("candidate", JSON.stringify(candidate));
    plugin.logger.debug("candidateImage", candidate.candidateImage);
    return candidate.candidateImage !== undefined
  }

  replyToTweet(config) {
    const plugin = this;
    var tags = plugin.getPluginTags();
    var { pluginName, pluginTags, pluginMoreTags, doSimulate, order, candidate } = config;
    if (pluginMoreTags !== undefined) {
      tags = [tags, pluginMoreTags].join(' ');
    }

    if (!plugin.candidateMatch(candidate)) {
      return Promise.reject({ "message": "candidate dont match plugin requirements", "status": 400});
    }

    const identifyOptions = { "image":candidate.candidateImage,
                              doSimulate,
                              candidate,
                              "users": candidate.users,
                              tags,
                              order
    };
    plugin.logger.debug("identifyOptions : ", identifyOptions);
    return new Promise(async function(resolve, reject) {
      plugin.plantnetIdentify(identifyOptions).then(resolve).catch(reject)
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
      pluginTags = [pluginTags, pluginMoreTags].join(' ');
    }

    doSimulate = (config.doSimulate === true);

    return new Promise(async function(resolve, reject) {

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
      const tweetCandidate = common.randomFromArray(tweets);
      if (!tweetCandidate) {
          plugin.logger.info("no candidate for " + pluginName );
          reject({ "message": "aucun candidat pour " + pluginName, "status": 202});
          return;
      }

      const candidatePhoto = plugin.twitterAPIV2Service.tweetFirstPhotoMedia(tweetCandidate, medias);
      const candidateImage = candidatePhoto?.url;
      plugin.logger.debug("tweetCandidate : " +
          plugin.twitterAPIV2Service.tweetLinkOf(tweetCandidate, users) + "\n\t" +
          plugin.twitterAPIV2Service.tweetInfoOf(tweetCandidate, users) + "\n\t" +
          "first media url : " + candidateImage + "\n");

      if (!candidateImage) {
          plugin.logger.info("no candidate image");
          reject({ "message": "aucune image pour pl@ntnet dans" + plugin.twitterAPIV2Service.tweetLinkOf(tweetCandidate, users), "status": 202});
          return;
      }
      const identifyOptions = { "image":candidateImage,
                                doSimulate,
                                "candidate": { "tweet" : tweetCandidate, users},
                                "tags":pluginTags
      };
      plugin.logger.debug("identifyOptions : ", identifyOptions);
      plugin.plantnetIdentify(identifyOptions).then(resolve).catch(reject)
    });
  }

  _debugLogTweets(tweets, users) {
      let debugLog = "";
      tweets.forEach((t) => {
          debugLog += "\n\t" + this.twitterAPIV2Service.tweetLinkOf(t, users) + "\n\t\t" + this.twitterAPIV2Service.tweetInfoOf(t, users);
          // debugLog += JSON.stringify(t) ;
      });
      this.logger.debug("tweets " + debugLog);
  }

  replyScoredResult(options, firstScoredResult) {
    const plugin = this;
    const {doSimulate, tags, candidate, order, users} = options;
    return new Promise(async (resolve, reject) => {
      plugin.plantnetService.resultImageOf(firstScoredResult, (illustrateImage) => {
        let replyMessage = "Pl@ntnet identifie " +
        plugin.plantnetService.resultInfoOf(firstScoredResult) + "\n" +
        (illustrateImage ? "\n\n" + illustrateImage : "") + "\n\n" +
        tags;

        plugin.replyResult(options, replyMessage).catch(reject).then(resolve);
      });
    });

  }

  replyNotFoundResult(options) {
      const {doSimulate, tags, candidate, order, users} = options;
      const replyMessage = "Bonjour, j'ai interrogé Pl@ntnet pour tenter d'identifier votre première image" +
      " mais a priori il ne s'agit ni d'une plante ni d'une fleur 😏 ?\n" +
      "Je me suis bien fait avoir 😊 !\n\n" + tags;
      return this.replyResult(options, replyMessage);
   }

  replyNoScoredResult(options) {
      const {doSimulate, tags, candidate, order, users} = options;
      const replyMessage = "Bonjour, j'ai interrogé Pl@ntnet pour tenter d'identifier votre première image" +
      " mais cela n'a pas donné de résultat concluant 😩 (score>" + PLANTNET_MINIMAL_PERCENT + "%).\n" +
      "Astuce: bien cadrer la fleur ou feuille\n\n" + tags;
      return this.replyResult(options, replyMessage);
  }

  replyResult(options, replyMessage) {
    const plugin = this;
    const {doSimulate, tags, candidate, order, users} = options;
    plugin.logger.info("reply result", JSON.stringify({
       doSimulate,
       "candidate": candidate.tweet,
       "order": order?.tweet,
       replyMessage
    },null,2));

    const replyToTweet = order?.tweet ? order?.tweet : candidate.tweet;
    const replyToUsers = order?.tweet ? order?.users : candidate.users;
    const quoteToTweet = order?.tweet ? candidate.tweet : undefined;
    const quoteToUsers = order?.tweet ? candidate.users : undefined;


    return new Promise(async function(resolve, reject) {
      const repTweet = await plugin.replyTweet(doSimulate, replyToTweet, replyToUsers, replyMessage, quoteToTweet, quoteToUsers)
                                     .catch( err => {
                                         plugin.logError("replyTweet", {err, doSimulate,  replyToTweet, quoteToTweet, replyMessage});
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

  searchTweets(plantnetSearch) {
    const plugin = this;
    const common = plugin.common;
    return new Promise(async function(resolve, reject) {
      const botEnTrainId = '1254020717710053376';
      const noRetweet = " (-is:retweet)";
      const notMe = " (-from:botEnTrain1)";
      plugin.logger.debug("get recent answers");
      const recentAnswersIds = await plugin.twitterAPIV2Service.getRecentlyAnsweredStatuses(botEnTrainId, 100)// valid range : 5..100
                                           .catch(err => {
                                              plugin.logError("twitterV2Service.getRecentlyAnsweredStatuses", {botEnTrainId, err});
                                              reject("Unable to search tweets");
                                           });
      if (recentAnswersIds === undefined) {
        return;
      }
      const searchQueryNotMe = plantnetSearch + noRetweet + notMe;
      var {tweets, users, medias, rateLimit} = await plugin.twitterAPIV2Service.searchRecent(searchQueryNotMe, 50)
                                                   .catch( err => {
                                                     plugin.logError("twitterV2Service.searchRecent", {searchQueryNotMe, err});
                                                     reject("Unable to search tweets");
                                                   });
      if (tweets === undefined) {
        return;
      }
      var filteredTweets = tweets;
      if (common.arrayWithContent(tweets) && common.arrayWithContent(recentAnswersIds)) {
        filteredTweets = common.filterTweetsExcludingIds(tweets, recentAnswersIds);
        plugin.logger.debug("Exclude " + (tweets.length - filteredTweets.length));
      }
      resolve({"tweets":filteredTweets, users, medias});
    });
  }

  replyTweet(doSimulate, tweet,  users, replyMessage, quoteTweet = null, quoteUsers = null) {
    return this.twitterAPIV2Service.replyTo(tweet, users, replyMessage, doSimulate, quoteTweet, quoteUsers);
  }

  logError(action, err) {
    if (Object.keys(err) && Object.keys(err).length > 0) {
      this.logger.error(action, JSON.stringify(err, null, 2));
      return;
    }
    this.logger.error(action, err);
  }
}
