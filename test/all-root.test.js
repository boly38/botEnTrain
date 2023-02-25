import InitEnv from './InitEnv.js';

import { ContainerBuilder } from 'node-dependency-injection';
import ApplicationConfig from '../src/config/ApplicationConfig.js';
const appConfig = ApplicationConfig.getInstance();

const nodeEnv = process.env.NODE_ENV;
before(async function () {
  console.info(`ROOT :: before - env:${nodeEnv}`);

});

after(function () {
  console.info("ROOT::after");

});