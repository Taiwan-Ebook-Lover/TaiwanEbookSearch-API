import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';

import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;

import { Book } from '../interfaces/book.js';
import { Result } from '../interfaces/result.js';
import { getProcessTime } from '../interfaces/general.js';
import { FirestoreBookstore } from '../interfaces/firestoreBookstore.js';

export default ({ proxyUrl, ...bookstore }: FirestoreBookstore, keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  if (!bookstore.isOnline) {
    const hrEnd = process.hrtime(hrStart);
    const processTime = getProcessTime(hrEnd);
    const result: Result = {
      bookstore,
      isOkay: false,
      status: 'Bookstore is offline',
      processTime,
      books: [],
      quantity: 0,
    };

    return result;
  }

  // URL encode
  keywords = encodeURIComponent(keywords);
  const base = `https://ebook.hyread.com.tw/searchList.jsp?search_field=FullText&MZAD=0&search_input=${keywords}`;

  const options = {
    method: 'GET',
    compress: true,
    signal: timeoutSignal(10000),
    agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
    headers: {
      'User-Agent': `Taiwan-Ebook-Search/${process.env.npm_package_version}`,
      cookie: 'notBot=1',
    },
  };

  return fetch(base, options)
    .then((response) => {
      if (!response.ok) {
        throw response.statusText;
      }

      return response.text();
    })
    .then((body) => {
      return _getBooks(cheerio.load(body), base);
    })
    .then((books) => {
      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);
      const result: Result = {
        bookstore,
        isOkay: true,
        status: 'Crawler success.',
        processTime,
        books,
        quantity: books.length,
      };

      return result;
    })
    .catch((error) => {
      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      console.log(error.message);

      const result: Result = {
        bookstore,
        isOkay: false,
        status: 'Crawler failed.',
        processTime,
        books: [],
        quantity: 0,
        error: error.message,
      };

      return result;
    });
};

// parse 找書
function _getBooks($: cheerio.CheerioAPI, base: string) {
  const $books = $('.book-wrap');

  let books: Book[] = [];

  // 找不到就是沒這書
  if (!$books.length) {
    // console.log('Not found in hyread!');

    return books;
  }

  $books.each((i, elem) => {
    const book = {
      id: ($(elem).children('.book-title-01').children('a').prop('href') ?? '').replace(
        /bookDetail.jsp\?id=/,
        '',
      ),
      thumbnail: $(elem)
        .children('.book-cover')
        .children('.book-overlay')
        .children('.book-link')
        .children('.coverBox')
        .children('.bookPic')
        .prop('src'),
      title: $(elem).children('.book-title-01').children('a').text(),
      link: new URL(
        $(elem).children('.book-title-01').children('a').prop('href') ?? '',
        base,
      ).toString(),
      priceCurrency: 'TWD',
      price: parseFloat($(elem).children('.book-money').children('.book-price').text()) || -1,
      // about: ,
    };

    books.push(book);
  });

  return books;
}
