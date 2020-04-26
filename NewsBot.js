/*jshint esversion: 6 */
const dateFormat = require('dateformat');

class NewsBot {
  constructor(maxBufferEntries) {
    this.max = maxBufferEntries && maxBufferEntries > 0 ? maxBufferEntries : 30;
    this.lastNews = [];
  }

  add(news) {
    var day = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    this.lastNews.splice(0, 0, day + " | " + news);
    if (this.lastNews.length > this.max) {
        thisl.lastNews.splice(0, 1);
    }
  }

  getNews() {
    return this.lastNews;
  }
}

module.exports = NewsBot;