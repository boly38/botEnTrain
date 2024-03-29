export default class ApplicationProperties {

  constructor() {
    this.buildCommonEnvironment();
    var isProd = false;
    switch(this.nodeEnv) {
      case 'production':
      case 'prod':
        this.buildProdEnvironment();
        isProd = true;
        break;
      case 'githubaction':
      case 'test':
        this.buildTestEnvironment();
        break;
      default :
      case 'development':
        this.buildDevEnvironment();
        break;
    }
    this.verifyProperties(isProd);
    console.log(`☑ properties ${this.nodeEnv}`);
  }

  buildCommonEnvironment() {
    this.nodeEnv = process.env.NODE_ENV || 'development';
    this.port = process.env.PORT || 5000;
    this.bot = {
      tokenSimulation: process.env.BOT_TOKEN_SIMULATION || false,
      tokenAction: process.env.BOT_TOKEN_ACTION || false,
      engineMinIntervalMs: process.env.BOT_ENGINE_MIN_INTERVAL_MS|0 || 59000, // | 0 convert to int
      plantnetSimulate: process.env.BOT_PLANTNET_SIMULATE === "true" || false
    };

    this.twitter1 = {
      // https://github.com/plhery/node-twitter-api-v2/blob/HEAD/doc/basics.md
      // OAuth 1.0a (User context)
      appKey: process.env.TWITTER_V1_APP_CONSUMER_KEY,
      appSecret: process.env.TWITTER_V1_APP_CONSUMER_SECRET,
      // Following access tokens are not required if you are
      // at part 1 of user-auth process (ask for a request token)
      // or if you want a app-only client (see below)
      accessToken: process.env.TWITTER_V1_APP_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_V1_APP_ACCESS_SECRET
    };
    this.twitter2 = {
      // https://github.com/plhery/node-twitter-api-v2/blob/HEAD/doc/basics.md
      bearerToken: process.env.TWITTER_V2_APP_BEARER_TOKEN
    };
    this.twitterExclusions = process.env.TWITTER_EXCLUDED_ACCOUNTS || null;


    this.plantnet = {
      apiKey: process.env.MYPLANTNET_API_PRIVATE_KEY
    };
  }

  buildProdEnvironment() {
    // example to clean // this.admins = _assumeIsSet(process.env.CH_ADMINS, "CH_ADMINS");
  }

  buildDevEnvironment() {
    this.nodeEnv = 'development';
    // example to clean // this.admins = _assumeIsSet(process.env.CH_ADMINS, "CH_ADMINS");
  }

  buildTestEnvironment() {
    // example to clean // this.admins = _assumeIsSet(process.env.CH_TEST_ADMINS, "CH_TEST_ADMINS");
  }

  verifyProperties(isProd) {
    _assumeIsSet(this.bot, "bot");
    _assumeIsSet(this.bot.engineMinIntervalMs, "bot.engineMinIntervalMs");

    _assumeIsSet(this.twitter1, "twitter1");
    _assumeIsSet(this.twitter1.appKey, "twitter1.appKey");
    _assumeIsSet(this.twitter1.appSecret, "twitter1.appSecret");
    // OAuth 2 flow not used today
    // _assumeIsSet(this.twitter1.accessToken, "twitter1.accessToken");
    // _assumeIsSet(this.twitter1.accessSecret, "twitter1.accessSecret");

    _assumeIsSet(this.twitter2, "twitter2");
    _assumeIsSet(this.twitter2.bearerToken, "twitter2.bearerToken");
    if (isProd) {
      _assumeIsSet(this.bot.tokenAction, "bot.tokenAction");
      _assumeIsSet(this.plantnet.apiKey, "plantnet.apiKey");
    }
  }
}

//~ private
function _assumeIsSet(expectedValue, name) {
  if (expectedValue === null || expectedValue === undefined || expectedValue === "") {
    throw `application properties expect following value to be set : ${name}`;
  }
  return expectedValue;
}

function _warnAssumeIsSet(expectedValue, name) {
  if (expectedValue === null || expectedValue === undefined || expectedValue === "") {
    console.warn(`warn: application properties expect following value to be set : ${name}`);
    return null;
  }
  return expectedValue;
}