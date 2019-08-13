require('dotenv').config();
const app = require('express')();
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const http = require('http').Server(app);
const db = require('./db');
const bot = require('./bot');
const searchRoute = require('./routers/search.js');

const init = () => {
  // Telegram bot is coming
  bot.init(process.env.TOKEN, process.env.GROUPID);
  // Database is coming too
  db.connect(process.env.DBURL);

  /**
   * Build db, Server
   */

  http.listen(process.env.PORT, () => {
    console.log(`listening on http://localhost:${process.env.PORT}`);
  });
};

// compress all responses
app.use(compression());

// for parsing application/json
app.use(bodyParser.json());

// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// for cors
app.use(
  cors({
    methods: ['GET', 'POST', 'PATCH', 'OPTION', 'DELETE'],
    credentials: true,
    origin: true,
  })
);

/**
 * Route
 */

app.use('/search', searchRoute);

/**
 * Error Handler
 */

app.get('*', function (req, res) {
  return res.status(405).send({
    message: 'Method Not Allowed!',
  });
});

init();
