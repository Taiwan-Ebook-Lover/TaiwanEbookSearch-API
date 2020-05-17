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

export const searchRouter = Router().get('/', (req, res, next) => {
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
      let response: AnyObject<any> = {};
      let results = [];

      for (let searchResult of searchResults) {
        response[searchResult.title] = searchResult.books;

        // Record numbers of books only
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

      if (db) {
        // insert search record
        insertRecord(record);
      }

      const report = {
        searchDateTime: format(searchDateTime, `yyyy/LL/dd HH:mm:ss`),
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
