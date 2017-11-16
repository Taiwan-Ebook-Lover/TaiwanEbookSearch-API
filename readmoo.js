const rp = require('request-promise-native');
const cheerio = require('cheerio');

function searchBooks(keywords = '') {
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
    transform: (body) => {
      return cheerio.load(body);
    }
  };

  return rp(options).then($ => {
    let books = [];

    $('#main_items li').each((i, elem) => {
      books[i] = {
        thumbnail: $(elem).children('.thumbnail').children('a').children('img').data('original'),
        title: $(elem).children('.caption').children('h4').children('a').text(),
        link: $(elem).children('.caption').children('h4').children('a').prop('href'),
        priceCurrency: $(elem).children('.caption').children('.price-info').children('meta[itemprop=priceCurrency]').prop('content'),
        price: parseFloat($(elem).children('.caption').children('.price-info').children('.our-price').children('strong').text()),
        about: $(elem).children('.caption').children('.description').text(),
      };
    });

    return books;
  });
}

exports.searchBooks = searchBooks;
