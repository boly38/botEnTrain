import path from 'path';
import fs from 'fs';

const __dirname = path.resolve();

class Common {

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

}

Common.version = null;

export default Common;