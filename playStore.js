const rp = require('request-promise-native');
const cheerio = require('cheerio');
const { URL, URLSearchParams } = require('url');

function searchBooks(keywords = '') {
  // URL encode
  keywords = encodeURIComponent(keywords);
  const base = `https://play.google.com/store/search?q=${keywords}&c=books&authuser=0&gl=tw&hl=zh-tw`;

  const options = {
    method: 'POST',
    uri: base,
    resolveWithFullResponse: true,
    simple: false,
  };

  return rp(options).then(response =>{
    if (!(/^2/.test('' + response.statusCode))) {
      // console.log('Not found or error in Play Sotre!');

      return [];
    }

    return _getBooks(cheerio.load(response.body), base);
  });
}

// parse 找書
function _getBooks($, base) {
  $list = $('.card-content');

  let books = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in Play Sotre!');

    return books;
  }

  $list.each((i, elem) => {
    // 先抓作者群字串（可能沒有）
    let authors = $(elem).children('.details').children('.subtitle-container').children('a.author').prop('title');

    // resolve book's link
    let linkUrl = new URL($(elem).children('a').prop('href'), base);

    // 設定書籍網址的語言與國家
    linkUrl.searchParams.set('gl', 'tw');
    linkUrl.searchParams.set('hl', 'zh-tw');

    let book = {
      // id: $(elem).children('.caption').children('.price-info').children('meta[itemprop=identifier]').prop('content'),
      thumbnail: $(elem).children('.cover').children('.cover-image-container').children('.cover-outer-align').children('.cover-inner-align').children('img').data('cover-small'),
      title: $(elem).children('.details').children('a.title').prop('title'),
      link: linkUrl.href,
      priceCurrency: 'TWD',
      price: parseFloat($(elem).children('.details').children('.subtitle-container').children('.price-container').children('.is-price-tag').children('button.price').children('.display-price').text().replace(/\$|,/g, '').replace(/免費/, '0')),
      about: $(elem).children('.details').children('.description').text(),
    };

    // 有作者群，才放
    if (authors) {
      book.authors = authors.split(/,|、/);
    }

    books[i] = book;
  });

  return books;
}

exports.searchBooks = searchBooks;
