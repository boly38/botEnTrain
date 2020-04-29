/*jshint esversion: 6 */
const log4js = require('log4js');
const TwitterClient = require('./TwitterClient.js');
const MyPlantnetClient = require('./MyPlantnetClient.js');
const FilmBTP = require('../plugins/FilmBTP');
const PlantnetBTP = require('../plugins/PlantnetBTP');

const ENGINE_MIN_INTERVAL_MS=10000;// min each 10 seconds

class BotEngine {
  constructor(newsBotDep, engineMinIntervalMs) {
    this.logger = log4js.getLogger();
    this.logger.setLevel('INFO');
    this.twitterClient = new TwitterClient();
    this.plantnetClient = new MyPlantnetClient();
    this.newsBot = newsBotDep;
    this.intervalMs = engineMinIntervalMs && engineMinIntervalMs >= ENGINE_MIN_INTERVAL_MS ?
        engineMinIntervalMs : ENGINE_MIN_INTERVAL_MS;
    this.plugins = [];
  }

  run() {
    let engine = this;
    let filmBTP = new FilmBTP(engine.twitterClient);
    engine.plugins.push(filmBTP);
    engine.plugins.push(new PlantnetBTP(engine.twitterClient, engine.plantnetClient));
    engine.defaultPlugin = filmBTP;
    engine.logInfo("started with " + engine.plugins.length +
       " plugin(s) and minInterval:" + this.intervalMs);
  }

  process(remoteAdd, doSimulate, pluginName, cb) {
    let engine = this;
    let nowMs = (new Date()).getTime();
    let allowedTs = engine.lastProcess + engine.intervalMs;
    let needToWaitSec = Math.floor((allowedTs - nowMs)/1000);
    if (engine.lastProcess && allowedTs > nowMs) {
        engine.logInfo(remoteAdd + " | need to wait " + needToWaitSec + " sec" );
        cb({"message": "Demande trop rapprochée, retentez plus tard",
           "status": 429});
        return;
    }
    engine.lastProcess = nowMs;
    let plugin = engine.getPluginByName(pluginName);
    if (!plugin || !plugin.isReady()) {
        engine.logInfo(remoteAdd + " | no plugin available");
        cb({"message": "je suis actuellement en maintenance, retentez plus tard",
            "status": 503});
        return;
    }
    engine.logInfo(remoteAdd + " | process right now - " + plugin.getPluginTags());
    engine.newsBot.add("Exécution du plugin - " + plugin.getPluginTags());
    plugin.process(doSimulate, (err, result) => {
        if(err) {
          engine.logWarn("plugin response status:" + err.status + " msg:" + err.message);
          engine.newsBot.add(err.message);
          cb(err);
          return;
        }
        engine.logInfo("plugin result "+ result.text);
        engine.newsBot.add(result.html);
        cb(false, result.text);
    });
  }

  getPluginByName(pluginName) {
    let engine = this;
    if (!pluginName) {
      return engine.defaultPlugin;
    }
    let availablePlugins = engine.plugins.filter( (p) => { return pluginName === p.getName(); });
    return availablePlugins.length > 0 ? this.randomFromArray(availablePlugins) : false;
  }

  randomFromArray(arr) {
    if (!Array.isArray(arr) || arr.length <= 0) {
        return undefined;
    }
    return arr[Math.floor(Math.random() * arr.length)];
  }

  logWarn(msg) {
    this.logger.warn("BotEngine | " + msg);
  }
  logError(msg) {
    this.logger.error("BotEngine | " + msg);
  }
  logInfo(msg) {
    this.logger.info("BotEngine | " + msg);
  }
  logDebug(msg) {
    this.logger.debug("BotEngine | " + msg);
  }
}

module.exports = BotEngine;