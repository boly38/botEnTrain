/*jshint esversion: 6 */
const dateFormat = require('dateformat');

class NewsBot {
  constructor(maxBufferEntries) {
    this.max = maxBufferEntries && maxBufferEntries > 0 ? maxBufferEntries : 10;
    this.lastNews = [];
  }

  add(news) {
    var day = dateFormat(new Date(), "yyyy-mm-dd HH:MM:ss");
    this.lastNews.splice(0, 0, day + " | " + news);
    if (this.lastNews.length > this.max) {
        this.lastNews.splice(this.lastNews.length-1, 1);
    }
  }

  getNews() {
    return this.lastNews;
  }
}

module.exports = NewsBot;