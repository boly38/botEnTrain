import InitEnv from './InitEnv.js';
import ApplicationConfig from '../src/config/ApplicationConfig.js';
ApplicationConfig.startApp()
                 .catch(console.error);