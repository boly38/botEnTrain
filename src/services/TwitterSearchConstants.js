const USERNAME="botEnTrain1";

// twitter doc // https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/build-a-query
const TwitterSearchConstants = {
  //~ independent of BeT
  IS_REPLY: ' (is:reply)',
  NOT_RETWEET: ' (-is:retweet)'
};

const BetSearchConstants = {
  //~ dependent of BeT
  BET_ID: '1254020717710053376',

  NOT_ME: ` (-from:${USERNAME})`,
  MENTION_ME: ` \"@${USERNAME}\"`

};

export {TwitterSearchConstants, BetSearchConstants};