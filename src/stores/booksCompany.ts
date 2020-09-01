import rp from 'request-promise-native';
import cheerio from 'cheerio';

import { Book } from '../interfaces/book';
import { getProcessTime } from '../interfaces/general';
import { Bookstore } from '../interfaces/bookstore';

const id = 'booksCompany' as const;
const displayName = '博客來' as const;

export default (bookstore: Bookstore, keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  if (!bookstore?.isOkay) {
    return [];
  }

  // URL encode
  keywords = encodeURIComponent(keywords);

  const options = {
    uri: `http://search.books.com.tw/search/query/key/${keywords}/cat/EBA`,
    resolveWithFullResponse: true,
    simple: false,
    gzip: true,
    timeout: 10000,
  };

  return rp(options)
    .then(response => {
      if (!/^2/.test('' + response.statusCode)) {
        // console.log('Not found or error in books company!');

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
  const $list = $('#searchlist ul li');

  let books: Book[] = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in books company!');

    return books;
  }

  $list.each((i, elem) => {
    // 合併作者成一個陣列
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
      price:
        parseFloat(
          $(elem)
            .children('.price')
            .children('strong')
            .last()
            .children('b')
            .text()
            .replace(/NT\$|,/g, '')
        ) || -1,
      about: $(elem)
        .children('p')
        .text()
        .replace(/...... more\n\t\t\t\t\t\t\t\t/g, ' ...'),
      publisher: $(elem)
        .children('a[rel=mid_publish]')
        .prop('title'),
    };

    // 作者群有資料才放
    if (authors.length > 0) {
      books[i].authors;
    }
  });

  return books;
}
