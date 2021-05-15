import timeoutSignal from 'timeout-signal';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import cheerio, { CheerioAPI } from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'playStore' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  const status = process.env.PLAYSTORE || 'open';
  const proxy = process.env.PROXY;
  const agent = status === 'proxy' && proxy ? new HttpsProxyAgent(proxy) : undefined;

  if (status === 'close') {
    const hrEnd = process.hrtime(hrStart);
    const processTime = getProcessTime(hrEnd);

    return {
      title,
      isOkay: false,
      processTime,
      books: [],
      error: {
        message: 'Bookstore is not open.',
        type: 'bookstore-invalid',
      },
    };
  }

  // URL encode
  keywords = encodeURIComponent(keywords);
  const rootURL = `https://play.google.com`;
  const base = `${rootURL}/store/search?q=${keywords}&c=books&authuser=0&gl=tw&hl=zh-tw`;

  const options = {
    method: 'GET',
    compress: true,
    signal: timeoutSignal(10000),
    agent,
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

      return {
        title,
        isOkay: true,
        processTime,
        books,
      };
    })
    .catch(error => {
      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      console.log(error.message);

      return {
        title,
        isOkay: false,
        processTime,
        books: [],
        error,
      };
    });
};

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

    // Prepare authors name
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

    // resolve book's link
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

    const price = $bookElem
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
      .sort((a: number, b: number) => a - b)[0];

    const id = linkUrl.searchParams.get('id') as string;

    // Set language and region
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
      price: price >= 0 ? price : -1,
    };

    if (authors) {
      book.authors = (authors || '').split(/,|、/);
    }

    books[i] = book;
  });

  return books;
}
