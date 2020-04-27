/*jshint esversion: 6 */
var log4js = require('log4js');

// const ENGINE_MIN_INTERVAL_MS=6000;//6 seconds // DEV MODE
const ENGINE_MIN_INTERVAL_MS=60*60000;// min 1 each hour*

class BotEngine {
  constructor(newsBotDep, engineMinIntervalMs) {
    this.logger = log4js.getLogger();
    this.logger.setLevel('INFO');
    this.newsBot = newsBotDep;
    this.intervalMs = engineMinIntervalMs && engineMinIntervalMs >= ENGINE_MIN_INTERVAL_MS ?
        engineMinIntervalMs : ENGINE_MIN_INTERVAL_MS;
  }

  run() {
    let engine = this;
    engine.newsBot.add("engine start !");
  }

  process(remoteAdd) {
    let engine = this;
    let nowMs = (new Date()).getTime();
    let allowedTs = engine.lastProcess + engine.intervalMs;
    if (engine.lastProcess && allowedTs > nowMs) {
        engine.logger.info(remoteAdd + " | need to wait ", allowedTs - nowMs, "ms" );
        return;
    }
    engine.lastProcess = nowMs;
    engine.logger.info(remoteAdd + " | process right now");
    engine.newsBot.add("process right now");
  }
}

module.exports = BotEngine;