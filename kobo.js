const rp = require('request-promise-native');
const cheerio = require('cheerio');
const url = require('url');
const marky = require('marky');

const title = 'kobo';

function searchBooks(keywords = '') {
  // start calc process time
  marky.mark('search');

  // URL encode
  keywords = encodeURIComponent(keywords);
  const base = `https://www.kobo.com/tw/zh/search?Query=${keywords}`;

  const options = {
    uri: base,
    resolveWithFullResponse: true,
    simple: false,
    gzip: true,
    timeout: 10000,
  };

  return rp(options).then(response =>{
    if (!(/^2/.test('' + response.statusCode))) {
      // console.log('Not found or error in kobo!');

      return [];
    }

    return _getBooks(cheerio.load(response.body), base);
  }).then(books => {
    // calc process time
    const processTime = marky.stop('search').duration;

    return {
      title,
      isOkay: true,
      processTime,
      books,
    };

  }).catch(error => {
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
function _getBooks($, base = null) {
  $list = $('ul[class=result-items] li');

  let books = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in kobo!');

    return books;
  }

  $list.each((i, elem) => {
    // 從 script elem 拉 JSON data
    const info = JSON.parse($(elem).children('.item-detail').children('script').html());

    // 若有副標題，併入主標題
    let title = info.name;
    if (info.alternativeHeadline) {
      title += ` - ${info.alternativeHeadline}`;
    }

    // 合併作者成一個陣列
    let authors = [];
    for (let item of info.author) {
      authors = authors.concat(item.name.split('、'));
    }

    // 價格要先檢查是否為免費
    const $priceField = $(elem).children('.item-detail').children('.item-info').children('.price');

    let price = 0;
    if (!$priceField.hasClass('free')) {
      price = parseFloat($priceField.children('span').children('span').first().text().replace(/NT\$|,|\s/g, '')) || -1;
    }

    books[i] = {
      id: info.isbn,
      // 圖片網址為相對位置，需要 resolve
      thumbnail: url.resolve(base, info.thumbnailUrl),
      title,
      link: info.url,
      priceCurrency: $(elem).children('.item-detail').children('.item-info').children('.price').children('span').children('.currency').text(),
      price,
      about: info.description ? `${info.description} ...` : null,
      // publisher
    };

    // 作者群有資料才放
    if (authors.length > 0) {
      books[i].authors;
    }

  });

  return books;
}

exports.searchBooks = searchBooks;
