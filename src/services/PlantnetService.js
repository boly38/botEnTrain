import log4js from 'log4js';
import fs from 'fs';
import superagent from 'superagent';
import queryString from 'querystring';
import TinyURL from 'tinyurl';

const MYPLANTNET_API_URL = 'https://my-api.plantnet.org/v2/identify/all';

// Pl@ntNet API : https://github.com/plantnet/my.plantnet/blob/master/README.md
export default class PlantnetService {

  constructor(config) {
    this.isAvailable = false;
    this.logger = log4js.getLogger('PlantnetService');
    this.logger.level = "INFO"; // DEBUG will show api params

    try {
        this.apiKey = config.plantnet.apikey;
        if (!this.apiKey) {
            throw "PlantnetService, please setup your environment";
        }
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
    const service = this;
    service.logger.info("identify following image : " + imageUrl + (doSimulate ? " SIMULATION " : ""));
    if (doSimulate === 'true') {
      let simulatedAnswer = fs.readFileSync('./src/data/plantNetFrenchResponse.json');
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
          "api-key": service.apiKey,
       })
    .end((err, res) => {
      if (err) {
        let errStatus = err.status;
        let errError = err.message;
        let errDetails = err.response.text;
        let errResult = "Pla@ntnet identify error (" + errStatus + ") " + errError;
        service.logger.error(errResult + " - details:" + errDetails);
        cb({ message: errResult, status: errStatus });
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
