import log4js from 'log4js';

export default class DialogBTP {
  constructor(plantnetBTP) {
    this.isAvailable = false;
    this.logger = log4js.getLogger('DialogBTP');
    this.logger.level = "INFO";
    this.plantnetBTP = plantnetBTP;
    this.isAvailable = this.plantnetBTP.isReady();
    this.logger.info((this.isAvailable ? "available" : "not available"));
  }

  getName() {
    return "DialogBTP";
  }

  getPluginTags() {
    return ["#BetDialog","#IndentificationDePlantes"].join(' ');
  }

  isReady() {
    return this.isAvailable;
  }

  process(config) {
     const pluginConfig = config;
     pluginConfig.pluginName = this.getName();
     pluginConfig.pluginTags = this.getPluginTags();
     pluginConfig.searchExtra = "\"@botentrain1\" (-from:botentrain1)";
     return this.plantnetBTP.process(pluginConfig);
  }
}
