import log4js from 'log4js';

const DEBUG_SERVICE = true;

export default class BotService {

  constructor(config, common, newsService, plugins = []) {
    this.logger = log4js.getLogger('BotService');
    this.logger.level = DEBUG_SERVICE ? "DEBUG" : "INFO";
    this.intervalMs = config.bot.engineMinIntervalMs;
    this.newsService = newsService;
    this.plugins = plugins;
  }

  run() {
    this.logger.debug("run()");
    let engine = this;
    engine.defaultPlugin = engine.plugins && engine.plugins.length > 0 ? engine.plugins[0] : null;
    engine.logger.info(`started - minInterval:${this.intervalMs} - ${this.getPluginsDetails()}`);
  }

  getPluginsDetails() {
    if (!Array.isArray(this.plugins) || this.plugins.length < 1) {
      return "(none)";
    }
    const pluginsNames = this.plugins.map (p => p.getName()).join(",");
    return `${this.plugins.length} plugin(s) : ${pluginsNames}`;
  }

  process(remoteAdd, doSimulate, pluginName) {
    const engine = this;
    return new Promise(async function(resolve, reject) {
      engine.logger.debug(`process(${remoteAdd}, sim:${doSimulate}, ${pluginName}, cb)`);
      const nowMs = (new Date()).getTime();
      const allowedTs = engine.lastProcess + engine.intervalMs;
      const needToWaitSec = Math.floor((allowedTs - nowMs)/1000);
      if (engine.lastProcess && allowedTs > nowMs) {
          engine.logger.info(remoteAdd + " | need to wait " + needToWaitSec + " sec" );
          reject({"message": "Demande trop rapprochée, retentez plus tard", "status": 429});
          return;
      }
      engine.lastProcess = nowMs;
      const plugin = engine.getPluginByName(pluginName);
      if (!plugin || !plugin.isReady()) {
          engine.logger.info(remoteAdd + " | no plugin available");
          reject({"message": "je suis actuellement en maintenance, retentez plus tard", "status": 503});
          return;
      }
      engine.logger.info(remoteAdd + " | process right now - " +
      plugin.getName() + (doSimulate ? " SIMULATE" :""));
      engine.newsService.add("Exécution du plugin - " + plugin.getName());
      const result = await plugin.process({ "doSimulate" : doSimulate })
                                 .catch( err => {
                                      engine.logger.warn("plugin response status:" + err.status + " msg:" + err.message);
                                      engine.newsService.add(err.html ? err.html : err.message);
                                      reject(err);
                                 });
      if (result !== undefined) {
          engine.logger.info("plugin result "+ result.text);
          engine.newsService.add(result.html);
          resolve(result.text);
      }
    });
  }

  getState() {
    let engine = this;
    let pluginsNames = [];
    engine.plugins.forEach((p) => {
        pluginsNames.push(p.getName());
    });
    return "Plugins : " + pluginsNames.join(", ");
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
}