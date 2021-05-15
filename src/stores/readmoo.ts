import timeoutSignal from 'timeout-signal';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import cheerio, { CheerioAPI } from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'readmoo' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  const status = process.env.READMOO || 'open';
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
  const base = `https://readmoo.com/search/keyword?pi=0&st=true&q=${keywords}&kw=${keywords}`;

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

function _getBooks($: CheerioAPI) {
  const $list = $('#main_items li');

  let books: Book[] = [];

  if (!$list.length) {
    // console.log('Not found in readmoo!');

    return books;
  }

  $list.each((i, elem) => {
    const authors = [
      $(elem)
        .children('.caption')
        .children('.contributor-info')
        .children('a')
        .text()
        .replace(/\s+/g, ''),
    ];

    const publisher = $(elem)
      .children('.caption')
      .children('.publisher-info')
      .children('a')
      .text()
      .replace(/\s+/g, '');

    const publishDate = $(elem)
      .children('.caption')
      .children('.publish-date')
      .children('span')
      .text()
      .replace(/出版日期：|\s/g, '');

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
        ($(elem)
          .children('.thumbnail')
          .children('a')
          .children('img')
          .data('lazy-original') as string) || '',
      title: $(elem).children('.caption').children('h4').children('a').text(),
      link: $(elem).children('.caption').children('h4').children('a').prop('href'),
      priceCurrency: $(elem)
        .children('.caption')
        .children('.price-info')
        .children('meta[itemprop=priceCurrency]')
        .prop('content'),
      price: price >= 0 ? price : -1,
      about: $(elem).children('.caption').children('.description').text(),
      authors: [
        $(elem)
          .children('.caption')
          .children('.contributor-info')
          .children('a')
          .text()
          .replace(/\s+/g, ''),
      ],
      publisher: $(elem)
        .children('.caption')
        .children('.publisher-info')
        .children('a')
        .text()
        .replace(/\s+/g, ''),
      publishDate: $(elem)
        .children('.caption')
        .children('.publish-date')
        .children('span')
        .text()
        .replace(/(出版日期：)|\s/g, ''),
    };

    if (authors.length > 0) {
      books[i].authors = authors;
    }

    if (publisher !== '') {
      books[i].publisher = publisher;
    }

    if (publishDate !== '') {
      books[i].publishDate = publishDate;
    }
  });

  return books;
}
