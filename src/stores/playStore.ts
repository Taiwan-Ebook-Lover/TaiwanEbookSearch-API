import cheerio, { CheerioAPI } from 'cheerio';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';

import { HttpsProxyAgent } from 'https-proxy-agent';

import { Book } from '../interfaces/book';
import { Result } from '../interfaces/result';
import { getProcessTime } from '../interfaces/general';
import { FirestoreBookstore } from '../interfaces/firestoreBookstore';

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
  const rootURL = `https://play.google.com`;
  const base = `${rootURL}/store/search?q=${keywords}&c=books&authuser=0&gl=tw&hl=zh-tw`;

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
      return _getBooks(cheerio.load(body), rootURL, base);
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
function _getBooks($: CheerioAPI, rootURL: string, base: string) {
  const $list = $('body > div')
    .eq(0)
    .children('div')
    .eq(3)
    .children('c-wiz')
    .children('div')
    .children('div')
    .eq(1)
    .children('div')
    .children('c-wiz')
    .children('c-wiz')
    .children('c-wiz')
    .children('div')
    .children('div')
    .eq(1)
    .children('div');

  let books: Book[] = [];

  // 找不到就是沒這書
  if (!$list.length) {
    console.log('Not found in Play Store!');

    return books;
  }

  $list.each((i, elem) => {
    const $bookElem = $(elem)
      .children('c-wiz')
      .children('div')
      .children('div')
      .children('div')
      .eq(1)
      .children('div')
      .children('div');

    // 先抓作者群字串（可能沒有）
    let authors: string = $bookElem
      .children('div')
      .eq(0)
      .children('div')
      .children('div')
      .children('div')
      .eq(1)
      .children('a')
      .children('div')
      .text();

    let linkUrl = new URL(
      $bookElem
        .children('div')
        .eq(0)
        .children('div')
        .children('div')
        .children('div')
        .eq(0)
        .children('a')
        .prop('href'),
      base
    );

    const id = linkUrl.searchParams.get('id') as string;

    // 設定書籍網址的語言與國家
    linkUrl.searchParams.set('gl', 'tw');
    linkUrl.searchParams.set('hl', 'zh-tw');

    let book: Book = {
      id,
      thumbnail: `${rootURL}/books/content/images/frontcover/${id}?fife=w320-h460`,
      title: $bookElem
        .children('div')
        .eq(0)
        .children('div')
        .children('div')
        .children('div')
        .eq(0)
        .children('a')
        .children('div')
        .prop('title'),
      link: linkUrl.href,
      priceCurrency: 'TWD',
      price: $bookElem
        .children('div')
        .eq(1)
        .children('div')
        .children('div')
        .children('div')
        .children('button')
        .children('div')
        .children('span')
        .map((index, priceElem) =>
          Number($(priceElem).children('span').text().replace(/\$|,/g, '').replace(/免費/, '0'))
        )
        .get()
        .sort((a: number, b: number) => a - b)[0],
      about: $bookElem
        .children('div')
        .eq(0)
        .children('div')
        .children('div')
        .children('div')
        .eq(2)
        .children('a')
        .text(),
    };

    // 有作者群，才放
    if (authors) {
      book.authors = (authors || '').split(/,|、/);
    }

    books[i] = book;
  });

  return books;
}
