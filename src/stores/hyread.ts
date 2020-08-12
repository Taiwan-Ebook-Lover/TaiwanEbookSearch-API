import { resolve as resolveURL } from 'url';

import rp from 'request-promise-native';
import cheerio from 'cheerio';

import { Book } from '../interfaces/book';
import { getProcessTime } from '../interfaces/general';

const id = 'hyread' as const;
const displayName = 'HyRead 電子書' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  // URL encode
  // keywords = encodeURIComponent(keywords);

  const base = `https://ebook.hyread.com.tw/searchList.jsp`;

  const options = {
    uri: base,
    qs: {
      search_field: 'FullText',
      MZAD: 0,
      search_input: keywords,
    },
    resolveWithFullResponse: true,
    simple: false,
    gzip: true,
    timeout: 10000,
  };

  return rp(options)
    .then(response => {
      if (!/^2/.test('' + response.statusCode)) {
        // console.log('Not found or error in hyread!');

        return [];
      }

      return _getBooks(cheerio.load(response.body), base);
    })
    .then(books => {
      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      return {
        id,
        displayName,
        isOkay: true,
        status: 'found',
        processTime,
        books,
        quantity: books.length,
      };
    })
    .catch(error => {
      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      console.log(error.message);

      return {
        id,
        displayName,
        isOkay: false,
        status: 'Time out.',
        processTime,
        books: [],
        quantity: 0,
        error,
      };
    });
};

// parse 找書
function _getBooks($: CheerioStatic, base: string) {
  const $books = $('.book-wrap');

  let books: Book[] = [];

  // 找不到就是沒這書
  if (!$books.length) {
    // console.log('Not found in hyread!');

    return books;
  }

  $books.each((index, elem) => {
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
      price:
        parseFloat(
          $(elem)
            .children('.book-money')
            .children('.book-price')
            .text()
        ) || -1,
      // about: ,
    };

    books.push(book);
  });

  return books;
}
