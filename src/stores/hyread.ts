import cheerio from 'cheerio';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';

import { resolve as resolveURL } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';

import { Book } from '../interfaces/book';
import { Result } from '../interfaces/result';
import { getProcessTime } from '../interfaces/general';
import { FirestoreBookstore } from '../interfaces/firebaseBookstore';

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
      'User-Agent': 'Taiwan-Ebook-Search/0.1',
    },
  };

  return fetch(base, options)
    .then(response => {
      if (!response.ok) {
        throw response.statusText;
      }

      return response.text();
    })
    .then(body => {
      return _getBooks(cheerio.load(body), base);
    })
    .then(books => {
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
    .catch(error => {
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
function _getBooks($: cheerio.Root, base: string) {
  const $books = $('.book-wrap');

  let books: Book[] = [];

  // 找不到就是沒這書
  if (!$books.length) {
    // console.log('Not found in hyread!');

    return books;
  }

  $books.each((i, elem) => {
    const book = {
      id: $(elem)
        .children('.book-title-01')
        .children('a')
        .prop('href')
        .replace(/bookDetail.jsp\?id=/, ''),
      thumbnail: $(elem)
        .children('.book-cover')
        .children('.book-overlay')
        .children('.book-link')
        .children('.coverBox')
        .children('.bookPic')
        .prop('src'),
      title: $(elem).children('.book-title-01').children('a').text(),
      link: resolveURL(base, $(elem).children('.book-title-01').children('a').prop('href')),
      priceCurrency: 'TWD',
      price: parseFloat($(elem).children('.book-money').children('.book-price').text()) || -1,
      // about: ,
    };

    books.push(book);
  });

  return books;
}
