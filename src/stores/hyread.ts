import { resolve as resolveURL } from 'url';

import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import cheerio from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'hyread' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  // if bookstore is close
  const status = process.env.HYREAD || 'open';
  if (status !== 'open') {
    const hrEnd = process.hrtime(hrStart);
    const processTime = getProcessTime(hrEnd);

    return {
      title,
      isOkay: false,
      processTime,
      books: [],
      error: {
        message: 'Bookstore is not open.',
        type: 'bookstore-invalid'
      },
    }
  }

  // URL encode
  keywords = encodeURIComponent(keywords);

  const base = `https://ebook.hyread.com.tw/searchList.jsp?search_field=FullText&MZAD=0&search_input=${keywords}`;

  const options = {
    method: 'GET',
    compress: true,
    timeout: 10000,
    agent: process.env.PROXY ? new HttpsProxyAgent(process.env.PROXY) : undefined,
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

function _getBooks($: CheerioStatic, base: string) {
  const $books = $('.book-wrap');

  let books: Book[] = [];

  if (!$books.length) {
    // console.log('Not found in hyread!');

    return books;
  }

  $books.each((index, elem) => {
    const price = parseFloat(
      $(elem)
        .children('.book-money')
        .children('.book-price')
        .text()
    );

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
      title: $(elem)
        .children('.book-title-01')
        .children('a')
        .text(),
      link: resolveURL(
        base,
        $(elem)
          .children('.book-title-01')
          .children('a')
          .prop('href')
      ),
      priceCurrency: 'TWD',
      price: price >= 0 ? price : -1,
      // about: ,
    };

    books.push(book);
  });

  return books;
}
