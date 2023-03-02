import InitEnv from './InitEnv.js';

import { ContainerBuilder } from 'node-dependency-injection';
import ApplicationConfig from '../src/config/ApplicationConfig.js';

const nodeEnv = process.env.NODE_ENV;
before(async () => {
  console.info(`ROOT :: before - env:${nodeEnv}`);
  await ApplicationConfig.startApp().catch(console.error)
});

after(async () => {
  console.info("ROOT::after");
  await ApplicationConfig.stopApp();
});