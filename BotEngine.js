/*jshint esversion: 6 */
class BotEngine {
  constructor(newsBotDep) {
    this.newsBot = newsBotDep;
  }

  run() {
    this.newsBot.add("engine start !");
  }
}

module.exports = BotEngine;