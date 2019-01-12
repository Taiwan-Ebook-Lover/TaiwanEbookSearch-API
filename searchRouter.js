const express = require('express');
const searchRouter = express.Router();
const marky = require('marky');
const uaParser = require('ua-parser-js');
const { format } = require('date-fns');
const db = require('./db');

const bookStoreModel = {
  readmoo: require('./readmoo'),
  booksCompany: require('./booksCompany'),
  kobo: require('./kobo'),
  taaze: require('./taaze'),
  bookWalker: require('./bookWalker'),
  playStore: require('./playStore'),
  pubu: require('./pubu'),
  hyread: require('./hyread'),
};

const bookStoreList = ['booksCompany', 'readmoo', 'kobo', 'taaze', 'bookWalker', 'playStore', 'pubu', 'hyread'];

searchRouter.get('/', (req, res, next) => {
  // start calc process time
  marky.mark('search books');

  const searchDateTime = new Date().toISOString();
  const keywords = req.query.q;
  const bookStoresRequest = req.query.bookStores || [];
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

  // 過濾掉不適用的書店
  let bookStores = bookStoresRequest.filter(bookStore => {
    return bookStoreList.includes(bookStore);
  });

  // 預設找所有書店
  if (bookStores.length === 0) {
    bookStores = bookStoreList;
  }

  // 等全部查詢完成
  Promise.all(
    bookStores.map(bookStore => bookStoreModel[bookStore].searchBooks(keywords))
  ).then((searchResults) => {
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
      let collection = db.get().db().collection('records');
      collection.insertOne(record).catch(error => {
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

module.exports = searchRouter;
