// const dateFormat = require('dateformat');

class NewsService {
  constructor() {
    this.max = 30;
    this.lastNews = [];
  }

  add(news) {
    // #69 // TO FIX // TypeError: Invalid date //  var day = dateFormat(this.getDate(), "yyyy-mm-dd HH:MM:ss");
    var day = this.getDate();
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

export default NewsService;