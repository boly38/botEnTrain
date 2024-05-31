# botEnTrain1

## State

- Since June 13 (2023), Twitter Lookup API is no more free, so botentrain twitter bot & project are stopped until new order.
Cf. #99 ticket.

- Since May 26 (2024), a new [BlueSky social app](https://bsky.app/) bot is born : [botEnSky](https://github.com/boly38/botEnSky).
- Since May 31, this repository is archived.

## Introduction
Written in JavaScript for node.js this project is a Twitter bot.

- Twitter account : [@botentrain1](https://twitter.com/botEnTrain1)
- Bot webPage : [botentrain.onrender.com](https://botentrain.onrender.com/)

## Bot features (plugins)

- French help - cf. [botentrain.onrender.com/aide](https://botentrain.onrender.com/aide)
- English [releases notes](https://github.com/boly38/botEnTrain/releases)  - via [![Automated Release Notes by gren](https://img.shields.io/badge/%F0%9F%A4%96-release%20notes-00B2EE.svg)](https://github-tools.github.io/github-release-notes/)

## Quick start

Clone this repository from GitHub:

```
$ git clone https://github.com/boly38/botEnTrain.git
```

### Prerequisites

1. Install NodeJs (https://nodejs.org/en/download/)
2. Install dependencies


````bash
npm install
````

### Set your own private environment

- study each required environment variable in the [template](./env/.env.template)
- copy the template in a private file

````bash 
cp ./env/.env.template ./env/.env.development
````

### Start the bot

Execute the application

````bash
npm startDev
````

or (production mode)

````bash
npm run start
````

### Contribution
Please submit a [pull request](https://github.com/boly38/botEnTrain/pulls)

Activated bot:
- [houndci](https://houndci.com/)

### Support (bug, improvement)

Please use [issues](https://github.com/boly38/botEnTrain/issues)


### Credits

Application and code structure: 
- [NodeJs](https://nodejs.org/) and Node dependencyes (cf. [graph](https://github.com/boly38/botEnTrain/network/dependencies)) 
- Twitter API ([doc](https://developer.twitter.com/en/docs))

Services
- GitHub actions
- [Render](https://render.com/) free app hosting and automated deployments
- [Cron-job.org](https://cron-job.org/) scheduler
- [PlantNet.org](https://plantnet.org) - plant identification service

Team: 
- cf. [contributors](https://github.com/boly38/botEnTrain/graphs/contributors)
