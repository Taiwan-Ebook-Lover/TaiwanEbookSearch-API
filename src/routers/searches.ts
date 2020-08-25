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
  readmoo,
  booksCompany,
  kobo,
  taaze,
  bookWalker,
  playStore,
  pubu,
  hyread,
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

const _telegramPrettier = (data: AnyObject<any>): string => {
  const results: [] = data.results.map(({ books, ...result }: AnyObject<any>) => result);
  return `
  Keywords: *${data.keywords}*
Search Time: ${data.searchDateTime}
Process Time: ${Math.round((data.processTime / 1000) * 100) / 100}s
Total: ${data.totalQuantity}
User Agent: ${data.userAgent.ua}
Search ID: \`${data.id}\`
Link: [🔗](https://yuer.tw/sunnyworm.png)
Bookstore Result: ${results.map(
    ({ displayName, isOkay, quantity, processTime }: AnyObject<any>): string => `
${isOkay ? '✅' : '❌'}  ${displayName} (${quantity} | ${
      Math.round((processTime / 1000) * 100) / 100
    }s)`
  )}
  `;
};

searchesRouter.post('/', (req, res, next) => {
  // start calc process time
  const hrStart = process.hrtime();

  const searchDateTime = new Date();
  const keywords = req.query.q;
  const bookstoresRequest: string[] = (req.query.bookstores as string[]) || [];
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
    .then(async searchResults => {
      // 整理結果並紀錄
      let results: any[] = [];
      let totalQuantity: number = 0;

      for (const searchResult of searchResults) {
        totalQuantity += searchResult.quantity;
        results.push({ ...searchResult });
      }

      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      const insertData: AnyObject<any> = {
        keywords,
        searchDateTime: format(searchDateTime, `yyyy/LL/dd HH:mm:ss`),
        processTime,
        userAgent: ua.getResult(),
        totalQuantity,
        results,
      };

      if (!firestore) {
        throw Error('Firestore is invalid.');
      }

      const search = await insertSearch(insertData);
      const telegramMessage: string = _telegramPrettier(search);

      sendMessage(telegramMessage);

      return res.status(201).send(search);
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

searchesRouter.get('/:id', async (req, res, next) => {
  const searchId: string = req.params.id;
  getSearch(searchId)
    .then(search => {
      if (search) {
        return res.status(200).send(search);
      } else {
        return res.status(404).send({
          message: 'Search not found.',
        });
      }
    })
    .catch(error => {
      console.time('Error time: ');
      console.error(error);

      return res.status(503).send({
        message: 'Something is wrong...',
      });
    });
});

export { searchesRouter };
