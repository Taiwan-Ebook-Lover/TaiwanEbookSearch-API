import fetch from 'node-fetch';
import cheerio from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'readmoo' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  // if bookstore is close
  if (process.env.READMOO && process.env.READMOO !== 'open') {
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
  const base = `https://readmoo.com/search/keyword?pi=0&st=true&q=${keywords}&kw=${keywords}`;

  const options = {
    method: 'GET',
    compress: true,
    timeout: 10000,
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

function _getBooks($: CheerioStatic) {
  const $list = $('#main_items li');

  let books: Book[] = [];

  if (!$list.length) {
    // console.log('Not found in readmoo!');

    return books;
  }

  $list.each((i, elem) => {
    const price = parseFloat(
      $(elem)
        .children('.caption')
        .children('.price-info')
        .children('.our-price')
        .children('strong')
        .text()
        .replace(/NT\$|,/g, '')
    );

    books[i] = {
      id: $(elem)
        .children('.caption')
        .children('.price-info')
        .children('meta[itemprop=identifier]')
        .prop('content'),
      thumbnail:
        $(elem)
          .children('.thumbnail')
          .children('a')
          .children('img')
          .data('lazy-original') || '',
      title: $(elem)
        .children('.caption')
        .children('h4')
        .children('a')
        .text(),
      link: $(elem)
        .children('.caption')
        .children('h4')
        .children('a')
        .prop('href'),
      priceCurrency: $(elem)
        .children('.caption')
        .children('.price-info')
        .children('meta[itemprop=priceCurrency]')
        .prop('content'),
      price: price >= 0 ? price : -1,
      about: $(elem)
        .children('.caption')
        .children('.description')
        .text(),
    };
  });

  return books;
}
