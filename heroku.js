/*jshint esversion: 6 */
const express = require('express');
const PORT = process.env.PORT || 5000
const app = express();
const path = require('path');

express()
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/', (req, res) => res.render('pages/index'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));