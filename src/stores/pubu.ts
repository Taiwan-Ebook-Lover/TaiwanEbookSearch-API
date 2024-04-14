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
  const base = `https://www.pubu.com.tw/search?sort=0&orderBy=&haveBOOK=true&haveMAGAZINE=false&haveMEDIA=false&q=${keywords}`;

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
  const $list = $('#search-list-content').children('div').children('article');

  let books: Book[] = [];

  // 找不到就是沒這書
  if (!$list.length) {
    // console.log('Not found in Pubu!');
    return books;
  }

  $list.each((i, elem) => {
    // 價格列表包（部分書籍有一般版與下載版兩種價格）
    const $priceList = $(elem).find('.info-price').children('div');

    const id = $(elem).find('.cover').children('a').prop('data-ecga');

    let book: Book = {
      id,
      thumbnail: $(elem).find('.cover').children('a').children('img').prop('data-src'),
      title: $(elem).find('.cover').children('a').children('img').prop('title'),
      link: id ? new URL(`ebook/${id}`, base).toString() : '',
      priceCurrency: 'TWD',
      price: parseFloat($priceList.eq(0).children('span').text().replace('NT$', '')) || -1,
      authors: [
        ...$(elem)
          .find('.info-others')
          .children('a.author')
          .text()
          .trim()
          .split(/, |,|、|，|／/g)
          .map((author) => {
            // 特別分工的作者，改變格式
            const authorSplit = author.split('：');

            if (authorSplit.length > 1) {
              author = `${authorSplit[1]}（${authorSplit[0]}）`;
            }

            return author;
          }),
      ].flat(Infinity),
      publisher: $(elem).find('.info-others').children('a:not(.author)').text().trim(),
    };
    // 有多種價格，則為下載版
    if ($priceList.length > 1) {
      book.nonDrmPrice = parseFloat($priceList.eq(1).children('span').text());
    }

    books[i] = book;
  });

  return books;
}
