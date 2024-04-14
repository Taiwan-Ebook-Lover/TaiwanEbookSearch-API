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
  hyread
} from '../stores/index.js';

const bookstoreModel: AnyObject<any> = {
  readmoo,
  booksCompany,
  kobo,
  taaze,
  bookWalker,
  playStore,
  pubu,
  hyread
};

export const searchRouter = Router().get('/', async (req, res, next) => {
  // start calc process time
  const hrStart = process.hrtime();

  const searchDateTime = new Date();
  const keywords = req.query.q as string;
  const bombMessage = req.query.bomb;

  // parse user agent
  const ua = new UAParser(req.headers['user-agent']);

  if (bombMessage) {
    return res.status(503).send({
      message: bombMessage,
    });
  }

  if (!keywords) {
    return res.status(400).send({
      message: 'q is required.',
    });
  }

  let bookstores = await getBookstores();
  bookstores = bookstores.filter((bookstore: Bookstore) => bookstore.id != 'kindle');
  console.log(bookstores);

  Promise.all(
    bookstores.map((bookstore: Bookstore) => bookstoreModel[bookstore.id](bookstore, keywords))
  )
    .then(async searchResults => {
      console.log(searchResults);
      const response = Object.fromEntries(
        searchResults.map(result => [result.title, result.books])
      );

      const results = searchResults.map(({ books, ...result }) => ({
        ...result,
        quantity: books.length,
      }));

      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      const recordBase = {
        keywords,
        results,
        processTime,
        ...ua.getResult(),
      };

      const record = {
        searchDateTime,
        ...recordBase,
      };

      const report = {
        ...record,
        searchDateTime: format(searchDateTime, `yyyy/LL/dd HH:mm:ss`),
      };

      sendMessage(`${JSON.stringify(report, null, '  ')}`);

      let firestoreResults: any[] = [];
      let totalQuantity: number = 0;

      for (const searchResult of searchResults) {
        totalQuantity += searchResult.quantity;
        firestoreResults.push({ ...searchResult });
      }

      const insertData: AnyObject<any> = {
        keywords,
        searchDateTime: format(searchDateTime, `yyyy/LL/dd HH:mm:ss`),
        processTime,
        userAgent: ua.getResult(),
        totalQuantity,
        results: firestoreResults,
        apiVersion: process.env.npm_package_version
      };

      if (!firestore) {
        throw Error('Firestore is invalid.');
      }

      await insertSearch(insertData);

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
