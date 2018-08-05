require('dotenv').config();
const MongoClient = require('mongodb').MongoClient;
const app = require('express')();
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const uaParser = require('ua-parser-js');
const rp = require('request-promise-native');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');
const { format } = require('date-fns');
const marky = require('marky');
const http = require('http').Server(app);

const readmoo = require('./readmoo');
const booksCompany = require('./booksCompany');
const kobo = require('./kobo');
const taaze = require('./taaze');
const bookWalker = require('./bookWalker');
const playStore = require('./playStore');
const pubu = require('./pubu');
const hyread = require('./hyread');

// Telegram bot is coming
const bot = new TelegramBot(process.env.TOKEN, {polling: false});

// Connect DB
let db;
MongoClient.connect(process.env.DBURL, { useNewUrlParser: true }).then(client => {
  db = client.db();
}).catch(error => {
  console.log(error.stack);
});

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

app.get('/search', (req, res, next) => {
  // start calc process time
  marky.mark('search books');

  const searchDateTime = new Date().toISOString();
  const keywords = req.query.q;
  const bombMessage = req.query.bomb;

  // parse user agent
  const ua = uaParser(req.headers['user-agent']);

  if (bombMessage) {
    return res.status(503).send({
      message: bombMessage
    })
  }

  // 關鍵字是必須的
  if (!keywords) {
    return res.status(400).send({
      message: 'q is required.'
    });
  }

  // 等全部查詢完成
  Promise.all([
    booksCompany.searchBooks(keywords),
    readmoo.searchBooks(keywords),
    kobo.searchBooks(keywords),
    taaze.searchBooks(keywords),
    bookWalker.searchBooks(keywords),
    playStore.searchBooks(keywords),
    pubu.searchBooks(keywords),
    hyread.searchBooks(keywords),
  ]).then((searchResults) => {
    // 整理結果並紀錄
    let response = {};
    let results = [];

    for (let searchResult of searchResults) {
      // 只回傳書的內容
      response[searchResult.title] = searchResult.books;

      // 資料庫只記錄數量
      const quantity = searchResult.books.length;

      delete searchResult.books;

      results.push({
        ...searchResult,
        quantity,
      })
    }

    // calc process time
    const processTime = marky.stop('search books').duration;

    // 準備搜尋歷史紀錄內容
    const recordBase = {
      keywords,
      results,
      processTime,
      ...ua,
    }

    // 寫入歷史紀錄
    const record = {
      searchDateTime,
      ...recordBase,
    }

    if (db) {
      // insert search record
      db.collection('records').insertOne(record).catch(error => {
        console.log(error.stack);
      });
    }

    // 發送報告
    const report = {
      searchDateTime: format(searchDateTime, `YYYY/MM/DD HH:mm:ss`),
      ...record,
    };

    bot.sendMessage(process.env.GROUPID, `${JSON.stringify(report, null, '  ')}`);

    return res.send(response);
  }).catch(error => {
    console.time('Error time: ');
    console.error(error);

    bot.sendMessage(process.env.GROUPID, JSON.stringify(error));

    return res.status(503).send({
      message: 'Something is wrong...'
    });
  });

});

app.get('*', function (req, res) {
  return res.status(405).send({
    message: 'Method Not Allowed!'
  });
});

http.listen(process.env.PORT, () => {
  console.log(`listening on http://localhost:${process.env.PORT}`);
});
