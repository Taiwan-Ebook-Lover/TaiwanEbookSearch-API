import { Router } from 'express';
import { UAParser } from 'ua-parser-js';
import { format } from 'date-fns';

import { sendMessage } from '../bot.js';
import { firestore, insertSearch, getSearch, getBookstores } from '../firestore.js';

import { AnyObject, getProcessTime } from '../interfaces/general.js';
import { Bookstore } from '../interfaces/bookstore.js';
import {
  readmoo,
  booksCompany,
  kobo,
  taaze,
  bookWalker,
  playStore,
  pubu,
  hyread,
  kindle,
  likerLand,
} from '../stores/index.js';

const bookstoreModel: AnyObject<any> = {
  readmoo,
  booksCompany,
  kobo,
  taaze,
  bookWalker,
  playStore,
  pubu,
  hyread,
  kindle,
  likerLand,
};

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
Link: [🔗](https://taiwan-ebook-lover.github.io/searches/${data.id})
Bookstore Result: ${results.map(
    ({ bookstore, isOkay, quantity, processTime }: AnyObject<any>): string => `
${isOkay ? '✅' : '❌'}  ${bookstore.displayName} (${quantity} | ${
      Math.round((processTime / 1000) * 100) / 100
    }s)`,
  )}
  `;
};

searchesRouter.post('/', async (req, res, next) => {
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

  const bookstores = await getBookstores();
  const validBookstores = bookstores.filter((store) => store.isOnline);

  let selectedBookstores = validBookstores.filter((store) => bookstoresRequest.includes(store.id));

  if (!selectedBookstores.length) {
    selectedBookstores = validBookstores;
  }

  // 等全部查詢完成
  Promise.all(
    selectedBookstores.map((bookstore: Bookstore) =>
      bookstoreModel[bookstore.id](bookstore, keywords),
    ),
  )
    .then(async (searchResults) => {
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
        apiVersion: process.env.npm_package_version,
      };

      if (!firestore) {
        throw Error('Firestore is invalid.');
      }

      const search = await insertSearch(insertData);
      const telegramMessage: string = _telegramPrettier(search);

      sendMessage(telegramMessage);

      return res.status(201).send(search);
    })
    .catch((error) => {
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
    .then((search) => {
      if (search) {
        return res.status(200).send(search);
      } else {
        return res.status(404).send({
          message: 'Search not found.',
        });
      }
    })
    .catch((error) => {
      console.time('Error time: ');
      console.error(error);

      return res.status(503).send({
        message: 'Something is wrong...',
      });
    });
});

export { searchesRouter };
