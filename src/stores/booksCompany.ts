import cheerio, { CheerioAPI } from 'cheerio';
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
  const base = `https://search.books.com.tw/search/query/cat/6/sort/1/v/0/page/1/spell/1/key/${keywords}`;

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
function _getBooks($: CheerioAPI) {
  const $list = $('#itemlist_table > tbody');

  let books: Book[] = [];

  if (!$list.length) {
    // console.log('Not found in books company!');

    return books;
  }

  $list.each((i, elem) => {
    let authors: string[] = [];

    $('a[rel=go_author]', elem).each((i, e) => {
      authors = authors.concat($(e).prop('title').split('、'));
    });

    const id = ($(elem).attr('id') ?? '').match(/(?<=itemlist_)\S*/)?.[0] ?? '';

    const price = parseFloat(
      $('.list-nav', elem)
        .children('li')
        .children('strong')
        .last()
        .text()
        .replace(/NT\$|,/g, ''),
    );

    books[i] = {
      id,
      thumbnail: $('.box_1', elem).children('a').children('img').prop('data-src') as string,
      title: $('a[rel=mid_name]', elem).prop('title'),
      link: `https://www.books.com.tw/products/${id}`,
      priceCurrency: 'TWD',
      price: price >= 0 ? price : -1,
      about: $('.txt_cont', elem)
        .children('p')
        .text()
        .replace(/...... more\n\t\t\t\t\t\t\t\t/g, ' ...'),
      publisher: $('a[rel=mid_publish]', elem).prop('title'),
    };

    if (authors.length > 0) {
      books[i].authors = authors;
    }
  });

  return books;
}
