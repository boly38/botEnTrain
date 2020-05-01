var expect    = require("chai").expect;
var TwitterClient = require("../core/TwitterClient");

describe("TwitterClient", function() {
  process.env.APPLICATION_CONSUMER_KEY_HERE = 'something';
  process.env.APPLICATION_CONSUMER_SECRET_HERE = 'something';
  process.env.ACCESS_TOKEN_HERE = 'something';
  process.env.ACCESS_TOKEN_SECRET_HERE = 'something';
  var twitterClient = new TwitterClient();

  describe("Tweet information extract", function() {
    it("get tweet link", function() {
      var tweetId = 1233321;
      var username = 'jojo';
      var link = twitterClient.tweetLinkOf({
        id_str: tweetId,
        user: {
          screen_name: username
        }
      });

      expect(link).to.equal(`https://twitter.com/${username}/status/${tweetId}`);
    });
  });

});