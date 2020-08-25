import rp from 'request-promise-native';
import cheerio from 'cheerio';

import { Book } from '../interfaces/book';
import { getProcessTime } from '../interfaces/general';

const id = 'kindle' as const;
const displayName = 'Amazon Kindle' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  const options = {
    uri: `https://www.amazon.com/s`,
    headers: {
      'User-Agent': 'Taiwan-Ebook-Search/0.0.2',
    },
    qs: {
      k: keywords,
      i: 'digital-text',
    },
    resolveWithFullResponse: true,
    simple: false,
    gzip: true,
    timeout: 10000,
  };

  return rp(options)
    .then(response => {
      if (!/^2/.test('' + response.statusCode)) {
        // console.log('Not found or error in kindle!');

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
  let books: Book[] = [];
  const $list = $('.s-main-slot').children();

  $list.each((i, elem) => {
    const id = $(elem).attr('data-asin');
    // 沒東西
    if (!id) {
      return;
    }
    const $h2 = $(elem).find('h2');
    books.push({
      id,
      title: $h2.text().trim(),
      price: parseFloat($(elem).find('.a-price .a-offscreen').eq(0).text().replace('$', '')),
      priceCurrency: 'USD',
      link: `https://www.amazon.com${$h2.find('a').attr('href')}`,
      about: '',
      thumbnail: $(elem).find('img').attr('src'),
    });
  });

  return books;
}
