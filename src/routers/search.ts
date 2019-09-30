import { Router } from 'express';
import { UAParser } from 'ua-parser-js';
import { format } from 'date-fns';

import { sendMessage } from '../bot';
import { db, insertRecord } from '../db';

import readmoo from '../stores/readmoo';
import booksCompany from '../stores/booksCompany';
import kobo from '../stores/kobo';
import taaze from '../stores/taaze';
import bookWalker from '../stores/bookWalker';
import playStore from '../stores/playStore';
import pubu from '../stores/pubu';
import hyread from '../stores/hyread';
import { AnyObject, getProcessTime } from '../interfaces/general';

const bookStoreModel = {
  readmoo,
  booksCompany,
  kobo,
  taaze,
  bookWalker,
  playStore,
  pubu,
  hyread,
};

const bookStoreList = [
  'booksCompany',
  'readmoo',
  'kobo',
  'taaze',
  'bookWalker',
  'playStore',
  'pubu',
  'hyread',
];

export const searchRouter = Router().get('/', (req, res, next) => {
  // start calc process time
  const hrStart = process.hrtime();

  const searchDateTime = new Date().toISOString();
  const keywords = req.query.q;
  const bookStoresRequest: string[] = req.query.bookStores || [];
  const bombMessage = req.query.bomb;

  // parse user agent
  const ua = new UAParser(req.headers['user-agent']);

  if (bombMessage) {
    return res.status(503).send({
      message: bombMessage,
    });
  }

  // 關鍵字是必須的
  if (!keywords) {
    return res.status(400).send({
      message: 'q is required.',
    });
  }

  // 過濾掉不適用的書店
  let bookStores: string[] = bookStoresRequest.filter(bookStore => {
    return bookStoreList.includes(bookStore);
  });

  // 預設找所有書店
  if (!bookStores.length) {
    bookStores = bookStoreList;
  }

  // 等全部查詢完成
  Promise.all([
    booksCompany(keywords),
    readmoo(keywords),
    kobo(keywords),
    taaze(keywords),
    bookWalker(keywords),
    playStore(keywords),
    pubu(keywords),
    hyread(keywords),
  ])
    .then(searchResults => {
      // 整理結果並紀錄
      let response: AnyObject<any> = {};
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
        });
      }

      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      // 準備搜尋歷史紀錄內容
      const recordBase = {
        keywords,
        results,
        processTime,
        ...ua.getResult(),
      };

      // 寫入歷史紀錄
      const record = {
        searchDateTime,
        ...recordBase,
      };

      if (db) {
        // insert search record
        insertRecord(record);
      }

      // 發送報告
      const report = {
        searchDateTime: format(searchDateTime, `YYYY/MM/DD HH:mm:ss`),
        ...record,
      };

      sendMessage(`${JSON.stringify(report, null, '  ')}`);

      return res.send(response);
    })
    .catch(error => {
      console.time('Error time: ');
      console.error(error);

      sendMessage(JSON.stringify(error));

      return res.status(503).send({
        message: 'Something is wrong...',
      });
    });
});
