/*jshint esversion: 6 */
const dateFormat = require('dateformat');
const express = require('express');
const path = require('path');
const pjson = require('./../package.json');

const NewsBot = require('./NewsBot.js');
const BotEngine = require('./BotEngine.js');

class BotEnTrain {
    constructor(port) {
      this.port = port || 5000;
      this.tokenSimulation = process.env.TOKEN_SIMULATION || false;
      this.tokenAction = process.env.TOKEN_ACTION || false;
      this.version = process.env.VERSION || pjson.version;
      this.engineMinIntervalMs = process.env.ENGINE_MIN_INTERVAL_MS || 59000;
      this.newsBot = new NewsBot(30);
    }

    run() {
        let bet = this;
        bet.newsBot.add("Réveil du robot en version " + bet.version);

        bet.botEngine = new BotEngine(bet.newsBot, bet.engineMinIntervalMs);
        bet.botEngine.run();

        express()
          .use(express.static(path.join(__dirname, '../public')))
          .set('views', path.join(__dirname, '../views'))
          .set('view engine', 'ejs')
          .get('/hook',
            (req, res) => bet.hookResponse(req, res))
          .get('/*',
            (req, res) => res.render('pages/index', {"news": bet.newsBot.getNews() }))
          .listen(bet.port, () => console.log(`Listening on ${ bet.port }`));
    }

    getRemoteAddress(request) {
        return request.headers['x-forwarded-for'] ?
            request.headers['x-forwarded-for']
            : request.connection.remoteAddress;
    }

    hookResponse(req, res) {
      let bet = this;
      try {
          let remoteAdd = bet.getRemoteAddress(req);
          let apiToken = req.get('API-TOKEN');
          let pluginName = req.get('PLUGIN-NAME');
          let doSimulate = bet.tokenSimulation && apiToken === bet.tokenSimulation;
          let doAction = !doSimulate && bet.tokenAction && apiToken === bet.tokenAction;
          if (!doSimulate && !doAction) {
            res.status(401).json({
                        success: false,
                        message: "Le milieu autorisé c'est un truc, vous y êtes pas vous hein !"
            });
            return;
          }
          bet.botEngine.process(remoteAdd, doSimulate, pluginName, (err, pluginResult) => {
            let msg = err ? err : pluginResult;
            res.status(err ? err.status : 200).json({
                        success: err ? false : true,
                        message: msg
            });
          });
      } catch (error) {
        let errId = "ERR_" + bet.getSecondeId();
        console.error(errId, error);
        res.status(500).json({
                      success: false,
                      message: "Erreur inattendue, merci de la signaler sur https://github.com/boly38/botEnTrain/issues - " + errId
                  });
      }
    }

    getSecondeId() {
      return dateFormat(this.getDate(), "yyyymmddHHMMss");
    }

    getDate() {
        return new Date().toLocaleString('fr-FR', {
           timeZone: 'Europe/Paris'
        });
    }
}


module.exports = BotEnTrain;