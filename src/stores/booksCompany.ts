import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import cheerio from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'booksCompany' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  // if bookstore is close
  const status = process.env.BOOKSCOMPANY || 'open';
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
  const base = `http://search.books.com.tw/search/query/key/${keywords}/cat/EBA`;

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
  const $list = $('#searchlist ul li');

  let books: Book[] = [];

  if (!$list.length) {
    // console.log('Not found in books company!');

    return books;
  }

  $list.each((i, elem) => {
    // Combine authors to array
    let authors: string[] = [];
    $(elem)
      .children('a[rel=go_author]')
      .each((i, elem) => {
        authors = authors.concat(
          $(elem)
            .prop('title')
            .split('、')
        );
      });

    const price = parseFloat(
      $(elem)
        .children('.price')
        .children('strong')
        .last()
        .children('b')
        .text()
        .replace(/NT\$|,/g, '')
    );

    books[i] = {
      id: $(elem)
        .children('.input_buy')
        .children('input')
        .prop('value'),
      thumbnail: $(elem)
        .children('a')
        .children('img')
        .data('original'),
      title: $(elem)
        .children('h3')
        .children('a')
        .prop('title'),
      link: `http://www.books.com.tw/products/${$(elem)
        .children('.input_buy')
        .children('input')
        .prop('value')}`,
      priceCurrency: 'TWD',
      price: price >= 0 ? price : -1,
      about: $(elem)
        .children('p')
        .text()
        .replace(/...... more\n\t\t\t\t\t\t\t\t/g, ' ...'),
      publisher: $(elem)
        .children('a[rel=mid_publish]')
        .prop('title'),
    };

    if (authors.length > 0) {
      books[i].authors;
    }
  });

  return books;
}
