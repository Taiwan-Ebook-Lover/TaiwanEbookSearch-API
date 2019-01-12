require('dotenv').config();
const app = require('express')();
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const http = require('http').Server(app);
const TelegramBot = require('node-telegram-bot-api');
const searchRoute = require('./searchRouter.js');
const db = require('./db');

// Telegram bot is coming
bot = new TelegramBot(process.env.TOKEN, {polling: false});

// compress all responses
app.use(compression());

// for parsing application/json
app.use(bodyParser.json());

// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// for cors
app.use(cors({
  methods: ['GET', 'POST', 'PATCH', 'OPTION', 'DELETE'],
  credentials: true,
  origin: true
}));

/**
 * Route
 */

app.use('/search', searchRoute);

/**
 * Error Handler
 */

app.get('*', function (req, res) {
  return res.status(405).send({
    message: 'Method Not Allowed!'
  });
});

/**
 * Build db, Server
 */
db.connect(process.env.DBURL, (err) => {
  if (err) {
    console.log(err);
    process.exit(1);
  } else {
    http.listen(process.env.PORT, () => {
      console.log(`listening on http://localhost:${process.env.PORT}`);
    });
  }
});
