/*jshint esversion: 6 */
const express = require('express');
const PORT = process.env.PORT || 5000
const app = express();
const path = require('path');
const VERSION = process.env.VERSION || "1.0.0";

const NewsBot = require('./NewsBot.js');
const BotEngine = require('./BotEngine.js');

var newsBot = new NewsBot();
newsBot.add("started bot " + VERSION + " right now");

var botEngine = new BotEngine(newsBot);
botEngine.run();

express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index', getPageData()))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));



function getPageData() {
  return {
       "version": VERSION,
       "news": newsBot.getNews()
   };
}