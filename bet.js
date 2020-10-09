try {
    const BotEnTrain = require('./core/BET.js');
    let bet = new BotEnTrain(process.env.PORT);
    bet.run();
} catch (exception) {
    console.info("BotEnTrain Exception: ", exception);
}