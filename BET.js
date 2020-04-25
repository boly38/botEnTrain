/*jshint esversion: 6 */
const Twit = require('twit');

class BET {
  constructor() {
    if (!process.env.APPLICATION_CONSUMER_KEY_HERE ||
    !process.env.APPLICATION_CONSUMER_SECRET_HERE ||
    !process.env.ACCESS_TOKEN_HERE ||
    !process.env.ACCESS_TOKEN_SECRET_HERE
    ) {
        throw "Please setup your environment";
    }
    this.twit = new Twit({
      consumer_key: process.env.APPLICATION_CONSUMER_KEY_HERE,
      consumer_secret: process.env.APPLICATION_CONSUMER_SECRET_HERE,
      access_token: process.env.ACCESS_TOKEN_HERE,
      access_token_secret: process.env.ACCESS_TOKEN_SECRET_HERE,
      timeout_ms:           6*1000,  // optional HTTP request timeout to apply to all requests.
      strictSSL:            true,
    });
  }

  process(cb) {
      console.log("process search/tweets");

      // Search parameters
      var params = {
        q: '#bot',
        count: 10,
        result_type: 'recent',
        lang: 'fr'
      };

      this.twit.get('search/tweets', params, (err, data, response) => {
        if(!err){
          // This is where the magic will happen
          data.statuses.forEach( statuse => {
                    console.log(" -t :", statuse.text);
          });
          console.log("\n\n");
          cb();
        } else {
          console.log("oops",err);
          cb();
        }
      });
  }

  bye() {
    console.log("\nbye");
    process.exit();
  }
}

module.exports = BET;