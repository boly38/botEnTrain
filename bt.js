/*jshint esversion: 6 */
const BET = require('./BET.js');
var log4js = require('log4js');

let logger = log4js.getLogger();
logger.setLevel('DEBUG');

try  {
  let bt = new BET();
  bt.process(function() {
    bt.bye();
  });
} catch (err) {
  logger.error(err);
}
