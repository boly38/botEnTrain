import log4js from 'log4js';
import dateFormat from 'dateformat';
import express from 'express';
import path from 'path';

const __dirname = path.resolve();

// const BotEngine = require('./BotEngine.js');

const DEBUG_SERVER = true;

class ExpressServer {
    constructor(services) {
      this.logger = log4js.getLogger('ExpressServer');
      this.logger.level = DEBUG_SERVER ? "DEBUG" : "INFO";
      const { config, common, newsService, botService } = services;

      this.common = common;
      this.newsService = newsService;
      this.botService = botService;
      this.port = config.port;
      this.tokenSimulation = config.bot.tokenSimulation;
      this.tokenAction = config.bot.tokenAction;
      this.version = common.getVersion();
      this.logger.debug("build", this.version);
    }

    init() {
        const expressServer = this;
        expressServer.logger.debug("init()");
        return new Promise(async function (resolve, reject) {
          try {
            expressServer.newsService.add("Réveil du robot en version " + expressServer.version);

            expressServer.botService.run();
            expressServer.listeningServer = express()
              .use(express.static(path.join(__dirname, './public')))
              .set('views', path.join(__dirname, './views'))
              .set('view engine', 'ejs')
              .get('/aide',
                (req, res) => res.render('pages/aide'))
              .get('/hook',
                (req, res) => expressServer.hookResponse(req, res))
              .get('/*',
                (req, res) => res.render('pages/index', {
                    "news": expressServer.newsService.getNews(),
                    "status": expressServer.getState(),
                }))
              .listen(expressServer.port, () => expressServer.logger.info(`Listening on ${ expressServer.port }`));

            resolve(expressServer.listeningServer);
          } catch (exception) {
            expressServer.common.error("make server exception:" + exception);
            console.trace(exception);

            reject(exception);
          }
        });
    }

    getRemoteAddress(request) {
        return request.headers['x-forwarded-for'] ?
            request.headers['x-forwarded-for']
            : request.connection.remoteAddress;
    }

    async hookResponse(req, res) {
      const expressServer = this;
      try {
          let remoteAdd = expressServer.getRemoteAddress(req);
          let apiToken = req.get('API-TOKEN');
          let pluginName = req.get('PLUGIN-NAME');
          let doSimulate = expressServer.tokenSimulation && apiToken === expressServer.tokenSimulation;
          let doAction = !doSimulate && expressServer.tokenAction && apiToken === expressServer.tokenAction;
          if (!doSimulate && !doAction) {
            this.logger.debug(JSON.stringify({code:401, doSimulate, doAction}));
            res.status(401).json({
                        success: false,
                        message: "Le milieu autorisé c'est un truc, vous y êtes pas vous hein !"
            });
            return;
          }

          const pluginResult = await expressServer.botService.process(remoteAdd, doSimulate, pluginName)
                                                  .catch(err => {
                                                    res.status(err.status).json({ success: false, message: err });
                                                  });
          if (pluginResult !== undefined) {
            res.status(200).json({success: true, message: pluginResult});
          }
      } catch (error) {
        let errId = "ERR_" + expressServer.getSecondeId();
        console.error(errId, error);
        res.status(500).json({
                      success: false,
                      message: "Erreur inattendue, merci de la signaler sur https://github.com/boly38/botEnTrain/issues - " + errId
                  });
      }
    }

    getSecondeId() {
      const secondeId = dateFormat(""+new Date(), "yyyymmddHHMMss");
      // this.logger.debug(process.env.TZ, secondeId);
      return secondeId;
    }

    getDate() {
        return new Date().toLocaleString('fr-FR', {
           timeZone: 'Europe/Paris'
        });
    }

    getState() {
      return this.botEngine ? this.botEngine.getState() : "Inactif";
    }
}



export default ExpressServer;