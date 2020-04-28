/*jshint esversion: 6 */
const log4js = require('log4js');
const TwitterClient = require('./TwitterClient.js');
const FilmBTP = require('../plugins/FilmBTP');

const ENGINE_MIN_INTERVAL_MS=10000;// min each 10 seconds

class BotEngine {
  constructor(newsBotDep, simulationDisabled, engineMinIntervalMs) {
    this.logger = log4js.getLogger();
    this.logger.setLevel('INFO');
    this.twitterClient = new TwitterClient(simulationDisabled);
    this.newsBot = newsBotDep;
    this.simulationDisabled = simulationDisabled;
    this.intervalMs = engineMinIntervalMs && engineMinIntervalMs >= ENGINE_MIN_INTERVAL_MS ?
        engineMinIntervalMs : ENGINE_MIN_INTERVAL_MS;
    this.plugins = [];
  }

  run() {
    let engine = this;
    engine.plugins.push(new FilmBTP(engine.twitterClient));
    engine.logInfo("started with " + engine.plugins.length +
       " plugin(s) and minInterval:" + this.intervalMs +
       (this.simulationDisabled ? "" : " *SIMULATION ONLY*"));
  }

  process(remoteAdd) {
    let engine = this;
    let nowMs = (new Date()).getTime();
    let allowedTs = engine.lastProcess + engine.intervalMs;
    let needToWaitSec = Math.floor((allowedTs - nowMs)/1000);
    if (engine.lastProcess && allowedTs > nowMs) {
        engine.logInfo(remoteAdd + " | need to wait " + needToWaitSec + " sec" );
        return;
    }
    engine.lastProcess = nowMs;
    let plugin = this.randomFromArray(this.plugins); // TODO create plugin chooser component
    if (!plugin || !plugin.isReady()) {
        engine.logInfo(remoteAdd + " | no plugin available");
        return;
    }
    engine.logInfo(remoteAdd + " | process right now - " + plugin.getPluginTags());
    engine.newsBot.add("Exécution du plugin - " + plugin.getPluginTags());
    plugin.process((err, result) => {
        if(err) {
          engine.logError("plugin error " + err);
        }
        engine.logInfo("plugin result "+ result.text);
        engine.newsBot.add(result.html);
    });
  }

  randomFromArray(arr) {
    if (!Array.isArray(arr) || arr.length <= 0) {
        return undefined;
    }
    return arr[Math.floor(Math.random() * arr.length)];
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