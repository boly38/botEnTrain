const dateFormat = require('dateformat');

class NewsBot {
  constructor(maxBufferEntries) {
    this.max = maxBufferEntries && maxBufferEntries > 0 ? maxBufferEntries : 10;
    this.lastNews = [];
  }

  add(news) {
    var day = dateFormat(this.getDate(), "yyyy-mm-dd HH:MM:ss");
    this.lastNews.splice(0, 0, day + " | " + news);
    if (this.lastNews.length > this.max) {
        this.lastNews.splice(this.lastNews.length-1, 1);
    }
  }

  getNews() {
    return this.lastNews;
  }

  getDate() {
    return new Date().toLocaleString('fr-FR', {
       timeZone: 'Europe/Paris'
    });
  }
}

module.exports = NewsBot;