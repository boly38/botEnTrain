const log4js = require('log4js');

class DialogBTP {
  constructor(plantnetBTP) {
    this.isAvailable = false;
    this.logger = log4js.getLogger('DialogBTP');
    this.logger.setLevel('INFO');
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

  process(config, cb) {
     let pluginConfig = config;
     pluginConfig.pluginName = this.getName();
     pluginConfig.pluginTags = this.getPluginTags();
     pluginConfig.searchExtra = "@botentrain1 -from:botentrain1";
     this.plantnetBTP.process(pluginConfig, cb);
  }
}

module.exports = DialogBTP;