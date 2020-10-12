import cheerio from 'cheerio';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';

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
  const base = `http://search.books.com.tw/search/query/key/${keywords}/cat/EBA`;

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
      return _getBooks(cheerio.load(body));
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
function _getBooks($: CheerioStatic) {
  const $list = $('#searchlist ul li');

  let books: Book[] = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in books company!');

    return books;
  }

  $list.each((i, elem) => {
    // 合併作者成一個陣列
    let authors: string[] = [];
    $(elem)
      .children('a[rel=go_author]')
      .each((i, elem) => {
        authors = authors.concat($(elem).prop('title').split('、'));
      });

    books[i] = {
      id: $(elem).children('.input_buy').children('input').prop('value'),
      thumbnail: $(elem).children('a').children('img').data('original'),
      title: $(elem).children('h3').children('a').prop('title'),
      link: `http://www.books.com.tw/products/${$(elem)
        .children('.input_buy')
        .children('input')
        .prop('value')}`,
      priceCurrency: 'TWD',
      price:
        parseFloat(
          $(elem)
            .children('.price')
            .children('strong')
            .last()
            .children('b')
            .text()
            .replace(/NT\$|,/g, '')
        ) || -1,
      about: $(elem)
        .children('p')
        .text()
        .replace(/...... more\n\t\t\t\t\t\t\t\t/g, ' ...'),
      publisher: $(elem).children('a[rel=mid_publish]').prop('title'),
    };

    // 作者群有資料才放
    if (authors.length > 0) {
      books[i].authors;
    }
  });

  return books;
}
