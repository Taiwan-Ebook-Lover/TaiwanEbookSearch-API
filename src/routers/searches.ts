import { Router } from 'express';
import { UAParser } from 'ua-parser-js';
import { format } from 'date-fns';

import { sendMessage } from '../bot';
import { firestore, insertSearch, getSearch } from '../firestore';

import readmoo from '../stores/readmoo';
import booksCompany from '../stores/booksCompany';
import kobo from '../stores/kobo';
import taaze from '../stores/taaze';
import bookWalker from '../stores/bookWalker';
import playStore from '../stores/playStore';
import pubu from '../stores/pubu';
import hyread from '../stores/hyread';
import { AnyObject, getProcessTime } from '../interfaces/general';

const bookstoreModel: AnyObject<any> = {
  readmoo: readmoo,
  booksCompany: booksCompany,
  kobo: kobo,
  taaze: taaze,
  bookWalker: bookWalker,
  playStore: playStore,
  pubu: pubu,
  hyread: hyread,
};

const bookstoreList = [
  'booksCompany',
  'readmoo',
  'kobo',
  'taaze',
  'bookWalker',
  'playStore',
  'pubu',
  'hyread',
];

const searchesRouter = Router();

searchesRouter.post('/', (req, res, next) => {
  // start calc process time
  const hrStart = process.hrtime();

  const searchDateTime = new Date();
  const keywords = req.query.q;
  const bookstoresRequest: string[] = req.query.bookstores || [];
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
  let bookstores: string[] = bookstoresRequest.filter(bookstore => {
    return bookstoreList.includes(bookstore);
  });

  // 預設找所有書店
  if (!bookstores.length) {
    bookstores = bookstoreList;
  }

  // 等全部查詢完成
  Promise.all(
    bookstores.map((bookstore: string) => {
      return bookstoreModel[bookstore](keywords);
    })
  )
    .then(searchResults => {
      // 整理結果並紀錄
      let response: AnyObject<any> = {};
      let results: any[] = [];

      for (const searchResult of searchResults) {
        results.push(searchResult);
      }

      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      response = {
        keywords,
        searchDateTime: format(searchDateTime, `yyyy/LL/dd HH:mm:ss`),
        processTime,
        ...ua.getResult(),
        results,
      };

      if (firestore) {
        // insert search record
        const id = insertSearch(response);
        response.id = id;
      }

      // 發送報告
      // const report = {
      //   searchDateTime: format(searchDateTime, `yyyy/LL/dd HH:mm:ss`),
      //   ...record,
      // };

      // sendMessage(`${JSON.stringify(report, null, '  ')}`);

      return res.status(201).send(response);
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

searchesRouter.get('/:id', (req, res, next) => {});

export { searchesRouter };
