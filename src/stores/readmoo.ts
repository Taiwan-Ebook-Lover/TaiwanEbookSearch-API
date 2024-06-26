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
  const base = `https://readmoo.com/search/keyword?pi=0&st=true&q=${keywords}&kw=${keywords}`;

  const options = {
    method: 'GET',
    compress: true,
    signal: timeoutSignal(10000),
    agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
    headers: {
      'User-Agent': `Taiwan-Ebook-Search/${process.env.npm_package_version}`,
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
      return _getBooks(cheerio.load(body));
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
function _getBooks($: cheerio.CheerioAPI) {
  const $list = $('#main_items li');

  let books: Book[] = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in readmoo!');

    return books;
  }

  $list.each((i, elem) => {
    const id = $(elem)
      .children('.caption')
      .children('.price-info')
      .children('meta[itemprop=identifier]')
      .prop('content');

    const apCode = Buffer.from(`https://readmoo.com/book/${id}`)
      .toString('base64')
      .replace(/\=*/g, '');
    const apId = process.env.READMOO_AP_ID;
    const link = apId
      ? `https://readmoo.com/ap/target/${apId}?url=${apCode}`
      : $(elem).children('.caption').children('h4').children('a').prop('href') ??
        'https://readmoo.com';

    const authors = [
      $(elem)
        .children('.caption')
        .children('.contributor-info')
        .children('a')
        .text()
        .replace(/\s+/g, ''),
    ];

    const publisher = $(elem)
      .children('.caption')
      .children('.publisher-info')
      .children('a')
      .text()
      .replace(/\s+/g, '');

    const publishDate = $(elem)
      .children('.caption')
      .children('.publish-date')
      .children('span')
      .text()
      .replace(/出版日期：|\s/g, '');

    books[i] = {
      id,
      thumbnail:
        ($(elem)
          .children('.thumbnail')
          .children('a')
          .children('img')
          .data('lazy-original') as string) || '',
      title: $(elem).children('.caption').children('h4').children('a').text(),
      link,
      priceCurrency: $(elem)
        .children('.caption')
        .children('.price-info')
        .children('meta[itemprop=priceCurrency]')
        .prop('content'),
      price:
        parseFloat(
          $(elem)
            .children('.caption')
            .children('.price-info')
            .children('.our-price')
            .children('strong')
            .text()
            .replace(/NT\$|,/g, ''),
        ) || -1,
      about: $(elem).children('.caption').children('.description').text(),
    };

    if (authors.length > 0) {
      books[i].authors = authors;
    }

    if (publisher !== '') {
      books[i].publisher = publisher;
    }

    if (publishDate !== '') {
      books[i].publishDate = publishDate;
    }
  });

  return books;
}
