import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';

import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;

import { Book } from '../interfaces/book.js';
import { Result } from '../interfaces/result.js';
import { getProcessTime } from '../interfaces/general.js';
import { FirestoreBookstore } from '../interfaces/firestoreBookstore.js';

export default (
  { proxyUrl, ...bookstore }: FirestoreBookstore,
  keywords = '',
  userAgent: string,
) => {
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
  const base = `https://www.kobo.com/tw/zh/search?fcmedia=Book&Query=${keywords}`;

  const options = {
    method: 'GET',
    compress: true,
    signal: timeoutSignal(10000),
    agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
    headers: {
      'User-Agent': `${userAgent}`,
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
  const $list = $('ul[class=result-items] li');

  let books: Book[] = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in kobo!');

    return books;
  }

  $list.each((i, elem) => {
    // 從 script elem 拉 JSON data
    const info = JSON.parse(
      $(elem).children('.item-detail').children('script').html() || '{ data: null }',
    ).data;

    // 若有副標題，併入主標題
    let title = info.name;
    if (info.alternativeHeadline) {
      title += ` - ${info.alternativeHeadline}`;
    }

    const authors = (
      eval(
        $(elem)
          .children('.item-detail')
          .children('.item-info')
          .children('.contributors')
          .children('.synopsis-contributors')
          .children('.synopsis-text')
          .children('.contributor-name')
          .data('track-info') as string,
      )?.author ?? ''
    ).split('、');

    // 價格要先檢查是否為免費
    const $priceField = $(elem).children('.item-detail').children('.item-info').children('.price');

    let price = 0;
    if (!$priceField.hasClass('free')) {
      price =
        parseFloat(
          $priceField
            .children('span')
            .children('span')
            .first()
            .text()
            .replace(/NT\$|,|\s/g, ''),
        ) || -1;
    }

    books[i] = {
      id: info.isbn,
      thumbnail: new URL(info.thumbnailUrl, base).toString(),
      title,
      link: info.url,
      priceCurrency: $(elem)
        .children('.item-detail')
        .children('.item-info')
        .children('.price')
        .children('span')
        .children('.currency')
        .text(),
      price,
      about: info.description ? `${info.description} ...` : undefined,
      // publisher
    };

    if (authors?.length > 0) {
      books[i].authors = authors;
    }
  });

  return books;
}
