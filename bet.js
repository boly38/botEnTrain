/*jshint esversion: 6 */
const BotEnTrain = require('./core/BET.js');

let bet = new BotEnTrain(process.env.PORT);
bet.run();