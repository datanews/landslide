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
    * For development, turn on all debugging: `DEBUG=* node index.js`
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

#### Services

These are optional but helpful for election day.

* [New Relic](https://elements.heroku.com/addons/newrelic) for monitoring.
    * Heroku add-on: `heroku addons:create newrelic:hawke`
    * Will need to set `NEW_RELIC_NO_CONFIG_FILE` to `true` and `NEW_RELIC_APP_NAME` to whatever.  Without these, the application will not load New Relic.  See [config instructions](https://docs.newrelic.com/docs/agents/nodejs-agent/hosting-services/nodejs-agent-heroku) for more details.
* [Papertrail](https://elements.heroku.com/addons/papertrail) for easier log viewing.
    * Heroku add-on: `heroku addons:create papertrail:ludvig`
* Load testing with [Loader.io]()
    * Heroku add-on: `heroku addons:create loaderio:basic`
    * Set `LOADERIO_VERIFY_TOKEN` to the host's verify token.

### Configuration

To actually run the application, you will need to configure certain things, specifically with application keys and secrets and the what not.  These should be stored in environment variables, or in an `.env` file.

* `SLACK_CLIENT_ID`
* `SLACK_CLIENT_SECRET`
* `SLACK_TEAM`
* `SLACK_USERS_PRIVATE`: Comma-separated list of slack emails that can view private (Election Protection) data.  For some reason, the basic identity information with Slack Sign-in doesn't provide username, hence the use of emails.
* `MOBILE_COMMONS_USER`
* `MOBILE_COMMONS_PASS`
* `MOBILE_COMMONS_CAMPAIGN`
* `SCREENDOOR_PROJECT`
* `SCREENDOOR_KEY`
* `ELECTION_PROTECTION_USER`
* `ELECTION_PROTECTION_PASS`
* `GOOGLE_API_KEY`
* `SESSION_SECRET`
* `HELLO_VOTE_KEY`: API key for incoming HelloVote data.
* `FETCH_INTERVAL_SECONDS`: Number of seconds to wait in between fetches.
* `FETCH_SINCE_MINUTES`: Number of minutes to look back with each fetch (after the first one), i.e. get data in the past hour.
* `MONGODB_URI`: Should be something like `mongodb://localhost:27017/electionland` or what is provided by the [MonogoLab Heroku addon](https://elements.heroku.com/addons/mongolab).
* `NODE_ENV`: Set to `test` and fake data will be put into the database, and the database name will be appended with `-test`.  Otherwise, use `development` or `production`.
* `DEBUG`: Debug level via [debug](https://www.npmjs.com/package/debug).  For development, `*` will debug all.  For production, some level might be helpful such as: `db,api,server,index,scheduler,data:*`
