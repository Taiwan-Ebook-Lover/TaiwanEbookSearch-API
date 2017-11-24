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
    resolveWithFullResponse: true,
    simple: false,
  };

  return rp(options).then(response =>{
    if (!(/^2/.test('' + response.statusCode))) {
      // console.log('Not found or error in readmoo!');

      return [];
    }

    return _getBooks(cheerio.load(response.body));
  });
}

// parse 找書
function _getBooks($) {
  $list = $('#main_items li');

  let books = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in readmoo!');

    return books;
  }

  $list.each((i, elem) => {
    books[i] = {
      id: $(elem).children('.caption').children('.price-info').children('meta[itemprop=identifier]').prop('content'),
      thumbnail: $(elem).children('.thumbnail').children('a').children('img').data('original'),
      title: $(elem).children('.caption').children('h4').children('a').text(),
      link: $(elem).children('.caption').children('h4').children('a').prop('href'),
      priceCurrency: $(elem).children('.caption').children('.price-info').children('meta[itemprop=priceCurrency]').prop('content'),
      price: parseFloat($(elem).children('.caption').children('.price-info').children('.our-price').children('strong').text()),
      about: $(elem).children('.caption').children('.description').text(),
    };
  });

  return books;
}

exports.searchBooks = searchBooks;
