import fs from 'fs';

import { ContainerBuilder } from 'node-dependency-injection';

import ApplicationProperties from './ApplicationProperties.js';
import Common from '../services/Common.js';
import NewsService from '../services/NewsService.js';

import TwitterAPIV2Service from '../services/TwitterAPIV2Service.js';
import PlantnetService from '../services/PlantnetService.js';

import FilmBTP from '../plugins/FilmBTP.js';
import PlantnetBTP from '../plugins/PlantnetBTP.js';
import DialogBTP from '../plugins/DialogBTP.js';

import BotService from '../services/BotService.js';
import ExpressServer from '../services/ExpressServer.js';

import log4js from 'log4js';

class ApplicationConfig {

    constructor() {
      this.logger = log4js.getLogger('ApplicationConfig');
      this.logger.level = "DEBUG"; // DEBUG will show api params
      const container = new ContainerBuilder();

      this.container = container;
      this.plugins = [];

      container.register('config', ApplicationProperties);
      container.register('common', Common);
      container.register('newsService', NewsService);

      container.register('twitterAPIV2Service', TwitterAPIV2Service)
               .addArgument( container.get('config') )
               .addArgument( container.get('common') );

      container.register('plantnetService', PlantnetService)
               .addArgument( container.get('config') );

      this.constructPlugins();
      this.constructBot();

    }

    constructPlugins() {
      const container = this.container;

      container.register('filmBTP', FilmBTP)
               .addArgument( container.get('twitterAPIV2Service') );
      container.register('plantnetBTP', PlantnetBTP)
               .addArgument( container.get('config') )
               .addArgument( container.get('twitterAPIV2Service') )
               .addArgument( container.get('plantnetService') );
      container.register('dialogBTP', DialogBTP)
               .addArgument( container.get('plantnetBTP') );

      this.plugins.push( container.get('filmBTP') );
      this.plugins.push( container.get('plantnetBTP') );
      this.plugins.push( container.get('dialogBTP') );
    }

    constructBot() {
      const container = this.container;

      container.register('botService', BotService)
        .addArgument( container.get('config') )
        .addArgument( container.get('common') )
        .addArgument( container.get('newsService') )
        .addArgument( this.plugins )
        ;
    }

    get(beanName) {
      return this.container.get(beanName);
    }
}

ApplicationConfig.singleton = null;
ApplicationConfig.getInstance = function getInstance() {
    if (ApplicationConfig.singleton === null) {
      ApplicationConfig.singleton = new ApplicationConfig();
    }
    return ApplicationConfig.singleton;
};

ApplicationConfig.startApp = async () => {
  try {
    const appConfig = ApplicationConfig.getInstance();

    appConfig.container
      .register('expressServer', ExpressServer)
      .addArgument( {
        config: appConfig.container.get('config'),
        common: appConfig.container.get('common'),
        newsService: appConfig.container.get('newsService'),
        botService: appConfig.container.get('botService')
      })
      ;

    const expressServer = appConfig.container.get('expressServer');
    ApplicationConfig.listeningServer = await expressServer.init()
                 .catch(errInitServer => {
      this.logger.error("Error, unable to init express server:" + errInitServer);
      throw "Init failed";
    });
  } catch (error) {
    // console.trace();// print stack
    if (ApplicationConfig.singleton !== null) {
      ApplicationConfig.singleton.close();
    }
    throw `Application failed to start: ${error}`;
  }

};

ApplicationConfig.stopApp = async () => {
  if (ApplicationConfig.listeningServer) {
    ApplicationConfig.listeningServer.close();
  }
}

export default ApplicationConfig;
