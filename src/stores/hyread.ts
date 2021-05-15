import timeoutSignal from 'timeout-signal';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import cheerio, { CheerioAPI } from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'hyread' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  const status = process.env.HYREAD || 'open';
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

  const base = `https://ebook.hyread.com.tw/searchList.jsp?search_field=FullText&MZAD=0&search_input=${keywords}`;

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
      return _getBooks(cheerio.load(body), base);
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

function _getBooks($: CheerioAPI, base: string) {
  const $books = $('.book-wrap');

  let books: Book[] = [];

  if (!$books.length) {
    // console.log('Not found in hyread!');

    return books;
  }

  $books.each((index, elem) => {
    const price = parseFloat($(elem).children('.book-money').children('.book-price').text());

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
      link: new URL($(elem).children('.book-title-01').children('a').prop('href'), base).toString(),
      priceCurrency: 'TWD',
      price: price >= 0 ? price : -1,
      // about: ,
    };

    books.push(book);
  });

  return books;
}
