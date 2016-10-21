Small server for collecting and reporting on MobileCommons data/texting.

## Install

### Locally and development

1. Install NodeJS
    * On Mac: `brew install node`
1. Install MongoDB
    * On Mac: `brew install mongo`
1. Run Mongo: `mongod --config /usr/local/etc/mongod.conf`
    * On Mac: `brew services start mongodb`
1. Create database; use `mongo` to open mongo shell. `use electionland`
1. Get code: `git clone ... && cd electionland-reporting`
1. Install dependencies: `npm install`
1. See *Configuration*

### Commands

* Run application with: `node index.js`
* Run scheduling task with: `node scheduler.js`

### Heroku

The following steps were taken to deploy on Heroku

1. Install Heroku command line tools.
1. Create app: `heroku apps:create electionland-reporting`
1. MongoLab DB: `heroku addons:create mongolab:shared-cluster-2`
1. Set configuration for the application like `heroku config:set SLACK_CLIENT_ID=XXXX`, See configuration below for all options.
1. Push code: `git push heroku master`
1. Scale web (as needed): `heroku ps:scale web=1:performance-m`
1. Scale clock/scheduler (as needed): `heroku ps:scale clock=1:standard-1x`

### Configuration

To actually run the application, you will need to configure certain things, specifically with application keys and secrets and the what not.  These should be stored in environment variables, or in an `.env` file.

* `SLACK_CLIENT_ID`
* `SLACK_CLIENT_SECRET`
* `SLACK_TEAM`
* `MOBILE_COMMONS_USER`
* `MOBILE_COMMONS_PASS`
* `MOBILE_COMMONS_CAMPAIGN`
* `SCREENDOOR_PROJECT`
* `SCREENDOOR_KEY`
* `GOOGLE_API_KEY`
* `SESSION_SECRET`
* `MONGODB_URI`: Should be something like `mongodb://localhost:27017/electionland` or what is provided by the [MonogoLab Heroku addon](https://elements.heroku.com/addons/mongolab).
* `NODE_ENV`: Set to `test` and fake data will be put into the database, and the database name will be appended with `-test`.  Otherwise, use `development` or `production`.
