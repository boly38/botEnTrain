/*jshint esversion: 6 */
const express = require('express');
const PORT = process.env.PORT || 5000;
const HOOK = process.env.HOOK_NAME || 'hookthatmustbesecure';
const path = require('path');
var pjson = require('./package.json');
const VERSION = process.env.VERSION || pjson.version;

const NewsBot = require('./core/NewsBot.js');
const BotEngine = require('./core/BotEngine.js');

var newsBot = new NewsBot(30);
newsBot.add("started bot " + VERSION + " right now");

var botEngine = new BotEngine(newsBot);
botEngine.run();

express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/'+HOOK, (req, res) => res.render('pages/index', getPageData(req, true)))
  .get('/*', (req, res) => res.render('pages/index', getPageData(req, false)))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

function getRemoteAddress(request) {
    return request.headers['x-forwarded-for'] ?
        request.headers['x-forwarded-for']
        : request.connection.remoteAddress;
}

function getPageData(request, hookOriginated) {
  let remoteAdd = getRemoteAddress(request);
  if (hookOriginated) {
    botEngine.process(remoteAdd);
  }
  return {
       "version": VERSION,
       "news": newsBot.getNews()
   };
}