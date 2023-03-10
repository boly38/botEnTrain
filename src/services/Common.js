import path from 'path';
import fs from 'fs';

const __dirname = path.resolve();

export default class Common {

  constructor() {
  }

  static readSync(projectFilePath) {
    const finalFilename = projectFilePath.startsWith('./') ?
            __dirname + '/' + projectFilePath.substring(2) :
            projectFilePath;
    return fs.readFileSync(finalFilename, 'utf8');
  }

  static loadJsonResource(jsonProjectFilePath) {
    const fileContent = Common.readSync(jsonProjectFilePath);
    const result = JSON.parse(fileContent);
    // DEBUG // console.log(result);
    return result;
  }

  getVersion() {
    if (Common.version === null) {
      Common.version = Common.loadJsonResource('./package.json').version;
    }
    return Common.version;
  }

  debug(msg) {
    console.info(msg);
  }

  info(msg) {
    console.info(msg);
  }

  error(msg) {
    console.error(msg);
  }

  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  randomFromArray(arr) {
    if (!Array.isArray(arr) || arr.length <= 0) {
        return undefined;
    }
    return arr[Math.floor(Math.random() * arr.length)];
  }

  arrayWithContent(arr) {
    return (Array.isArray(arr) && arr.length > 0);
  }

  filterTweetsExcludingIds(tweets, ids) {
    if (!tweets) {
      return [];
    }
    return tweets.filter(t => {
        return !ids.includes(t.id);
    });
  }

}

Common.version = null;
