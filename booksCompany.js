const rp = require('request-promise-native');
const cheerio = require('cheerio');

function searchBooks(keywords = '') {
  // URL encode
  keywords = encodeURIComponent(keywords);

  const options = {
    uri: `http://search.books.com.tw/search/query/key/${keywords}/cat/EBA`,
    transform: (body) => {
      return cheerio.load(body);
    }
  };

  return rp(options).then($ => {
    let books = [];

    $('#searchlist ul li').each((i, elem) => {
      let authors = [];

      // 合併作者成一個陣列
      $(elem).children('a[rel=go_author]').each((i, elem) => {
        authors[i] = $(elem).prop('title');
      });

      books[i] = {
        thumbnail: $(elem).children('a').children('img').data('original'),
        title: $(elem).children('h3').children('a').prop('title'),
        link: `http://www.books.com.tw/products/${$(elem).children('.input_buy').children('input').prop('value')}`,
        priceCurrency: 'TWD',
        price: parseFloat($(elem).children('.price').children('strong').children('b').text()),
        about: $(elem).children('p').text().replace(/......\ more\n\t\t\t\t\t\t\t\t/g, ' ...'),
        publisher: $(elem).children('a[rel=mid_publish]').prop('title'),
        authors
      };

    });

    return books;
  });
}

exports.searchBooks = searchBooks;
