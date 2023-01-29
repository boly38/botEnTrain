import InitEnv from './InitEnv.js';

import { ContainerBuilder } from 'node-dependency-injection';
import ApplicationConfig from '../src/config/ApplicationConfig.js';
const appConfig = ApplicationConfig.getInstance();

before(async function () {
  console.info("ROOT :: before");

});

after(function () {
  console.info("ROOT::after");

});