const rp = require('request-promise-native');
const cheerio = require('cheerio');
const marky = require('marky');

const title = 'booksCompany';

function searchBooks(keywords = '') {
  // start calc process time
  marky.mark('search');

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
      const processTime = marky.stop('search').duration;

      return {
        title,
        isOkay: true,
        processTime,
        books,
      };
    })
    .catch(error => {
      // calc process time
      const processTime = marky.stop('search').duration;

      console.log(error.message);

      return {
        title,
        isOkay: false,
        processTime,
        books: [],
        error,
      };
    });
}

// parse 找書
function _getBooks($) {
  const $list = $('#searchlist ul li');

  let books = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in books company!');

    return books;
  }

  $list.each((i, elem) => {
    // 合併作者成一個陣列
    let authors = [];
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
      //
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
        .replace(/......\ more\n\t\t\t\t\t\t\t\t/g, ' ...'),
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

exports.searchBooks = searchBooks;
