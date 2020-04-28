/*jshint esversion: 6 */
const dateFormat = require('dateformat');
const express = require('express');
const PORT = process.env.PORT || 5000;
const TOKEN_SIMULATION = process.env.TOKEN_SIMULATION || 'hooksimulation';
const TOKEN_ACTION = process.env.TOKEN_ACTION || false;
const path = require('path');
var pjson = require('./package.json');
const VERSION = process.env.VERSION || pjson.version;
const ENGINE_MIN_INTERVAL_MS = process.env.ENGINE_MIN_INTERVAL_MS || 59000;

const NewsBot = require('./core/NewsBot.js');
const BotEngine = require('./core/BotEngine.js');

var newsBot = new NewsBot(30);
newsBot.add("Réveil du robot en version " + VERSION);

var botEngine = new BotEngine(newsBot, ENGINE_MIN_INTERVAL_MS);
botEngine.run();

express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/hook',
    (req, res) => hookResponse(req, res))
  .get('/*',
    (req, res) => res.render('pages/index', {"news": newsBot.getNews() }))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

function getRemoteAddress(request) {
    return request.headers['x-forwarded-for'] ?
        request.headers['x-forwarded-for']
        : request.connection.remoteAddress;
}

function hookResponse(req, res) {
  try {
      let remoteAdd = getRemoteAddress(req);
      let apiToken = req.get('API-TOKEN');
      let doSimulate = TOKEN_SIMULATION && apiToken === TOKEN_SIMULATION;
      let doAction = !doSimulate && TOKEN_ACTION && apiToken === TOKEN_ACTION;
      if (!doSimulate && !doAction) {
        res.status(401).json({
                    success: false,
                    message: "Le milieu autorisé c'est un truc, vous y êtes pas vous hein !"
        });
        return;
      }
      botEngine.process(remoteAdd, doSimulate, (err, pluginResult) => {
        let msg = err ? err : pluginResult;
        res.status(err ? 400 : 200).json({
                    success: err ? false : true,
                    message: msg
        });
      });
  } catch (error) {
    let errId = "ERR_" + getSecondeId();
    console.error(errId, error);
    res.status(500).json({
                  success: false,
                  message: "Erreur inattendue, merci de la signaler sur https://github.com/boly38/botEnTrain/issues - " + errId
              });
  }
}

function getSecondeId() {
  return dateFormat(getDate(), "yyyymmddHHMMss");
}

function getDate() {
    return new Date().toLocaleString('fr-FR', {
       timeZone: 'Europe/Paris'
    });
}