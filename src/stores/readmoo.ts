import rp from 'request-promise-native';
import cheerio from 'cheerio';

import { Book } from '../interfaces/book';
import { getProcessTime } from '../interfaces/general';

const id = 'reedmoo' as const;
const displayName = 'Readmoo 讀墨' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  // URL encode
  keywords = encodeURIComponent(keywords);

  const options = {
    uri: `https://readmoo.com/search/keyword`,
    qs: {
      q: keywords,
      kw: keywords,
      pi: 0,
      st: true,
    },
    resolveWithFullResponse: true,
    simple: false,
    gzip: true,
    timeout: 10000,
  };

  return rp(options)
    .then(response => {
      if (!/^2/.test('' + response.statusCode)) {
        // console.log('Not found or error in readmoo!');

        return [];
      }

      return _getBooks(cheerio.load(response.body));
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
function _getBooks($: CheerioStatic) {
  const $list = $('#main_items li');

  let books: Book[] = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in readmoo!');

    return books;
  }

  $list.each((i, elem) => {
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
      price:
        parseFloat(
          $(elem)
            .children('.caption')
            .children('.price-info')
            .children('.our-price')
            .children('strong')
            .text()
            .replace(/NT\$|,/g, '')
        ) || -1,
      about: $(elem)
        .children('.caption')
        .children('.description')
        .text(),
    };
  });

  return books;
}
