/*jshint esversion: 6 */
var log4js = require('log4js');
const fs = require('fs');
const superagent = require('superagent');
const queryString = require('querystring');
const TinyURL = require('tinyurl');

const MYPLANTNET_API_URL = 'https://my-api.plantnet.org/v2/identify/all';

// Pl@ntNet API : https://github.com/plantnet/my.plantnet/blob/master/README.md
class MyPlantnetClient {

  constructor() {
    this.isAvailable = false;
    this.logger = log4js.getLogger('MyPlantnetClient');
    this.logger.setLevel('INFO'); // DEBUG will show api params

    try {
        if (!process.env.MYPLANTNET_API_PRIVATE_KEY) {
            throw "MyPlantnet, please setup your environment";
        }
        this.apiKey = process.env.MYPLANTNET_API_PRIVATE_KEY;
        this.isAvailable = true;
        this.logger.info("available");
    } catch (exception) {
        this.logger.error(exception);
    }
  }

  isReady() {
    return this.isAvailable;
  }

  identify(imageUrl, doSimulate, cb) {
      this.logger.info("identify following image : " + imageUrl + (doSimulate ? " SIMULATION " : ""));
      if (doSimulate === 'true') {
        let simulatedAnswer = fs.readFileSync('./core/data/plantNetFrenchResponse.json');
        cb(false, JSON.parse(simulatedAnswer));
        return;
      }
      // https://my.plantnet.org/account/doc // v2
      superagent.get(MYPLANTNET_API_URL)
      .query({
             "images": [imageUrl, imageUrl],
             "organs": ["flower","leaf"],
             "include-related-images": true,
             "lang": "fr",
            "api-key": this.apiKey,
         })
      .end((err, res) => {
        if (err) {
          let errStatus = err.status;
          let errError = err.message;
          let errDetails = err.response.text;
          let errResult = "Pla@ntnet identify error (" + errStatus + ") " + errError;
          this.logger.error(errResult + " - details:" + errDetails);
          cb(errResult);
          return;
        }
        cb(false, res.body);
      });
  }

  resultInfoOf(aResult) {
    if (!aResult) {
      return "";
    }
    let score = aResult.score;
    let scorePercent = (score * 100).toFixed(2);
    let scientificName = aResult.species ? aResult.species.scientificNameWithoutAuthor : false;
    let family =  aResult.species && aResult.species.family ? aResult.species.family.scientificNameWithoutAuthor : false;
    let commonNamesArray = aResult.species ? aResult.species.commonNames : false;

    let infoOf = `(à ${scorePercent}%)`;
    if (scientificName) {
      infoOf += ` ${scientificName}`;
    }
    if (family) {
      infoOf += ` (fam ${family})`;
    }
    if (this.arrayWithContent(commonNamesArray)) {
        let commonNamesArrayStr = commonNamesArray.join(', ');
        infoOf += ` com. ${commonNamesArrayStr}`;
    }
    return infoOf;
  }

  resultImageOf(aResult, cb) {
    if (!aResult) {
      cb(false);
      return;
    }
    let firstImage = aResult.images && aResult.images[0] ? aResult.images[0] : false;
    if (!firstImage) {
      cb(false);
      return;
    }
    let pnClient = this;
    let firstImageUrl = firstImage.url ? firstImage.url : {};
    let imageUrl = firstImageUrl.o ? firstImageUrl.o : firstImageUrl.m ? firstImageUrl.m : firstImageUrl.s;
    TinyURL.shorten(imageUrl, function(res, err) {
        if (err) {
            cb(pnClient.resultImageOfMessage(firstImage, imageUrl));
        }
        cb(pnClient.resultImageOfMessage(firstImage, res));
    });
  }

  resultImageOfMessage(firstImage, shortenUrl) {
    let imageCredits = firstImage.author; // firstImage.citation is too long for a tweet constraint
    let imageOrgan = firstImage.organ === 'flower' ? "fleur" :
                     firstImage.organ === 'leaf' ? 'feuille' : false;
    let imageOf = imageCredits;
    if (imageOrgan) {
        imageOf = `${imageOrgan} - ${imageOf}`;
    }
    return `${imageOf}\n${shortenUrl}`;
  }

  hasScoredResult(plantnetResponse, minimalScore) {
    if (!plantnetResponse || !plantnetResponse.results) {
        return false;
    }
    let resArray = plantnetResponse.results;
    resArray = resArray.filter( (res) => { return (res.score > minimalScore); } );
    return resArray.length > 0 ? resArray[0] : false;
  }

  arrayWithContent(arr) {
    return (Array.isArray(arr) && arr.length > 0);
  }
}


module.exports = MyPlantnetClient;