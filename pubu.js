const rp = require('request-promise-native');
const cheerio = require('cheerio');
const { URL } = require('url');
const marky = require('marky');

const title = 'pubu';

function searchBooks(keywords = '') {
  // start calc process time
  marky.mark('search');

  // URL encode
  keywords = encodeURIComponent(keywords);
  const base = `https://www.pubu.com.tw/search?q=${keywords}`;

  const options = {
    uri: base,
    resolveWithFullResponse: true,
    simple: false,
    gzip: true,
    timeout: 10000,
  };

  return rp(options).then(response =>{
    if (!(/^2/.test('' + response.statusCode))) {
      // console.log('Not found or error in Pubu!');

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
function _getBooks($, base) {
  $list = $('#search-list-content').children('article');

  let books = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in Pubu!');

    return books;
  }

  $list.each((i, elem) => {
    // 價格列表包（部分書籍有一般版與下載版兩種價格）
    const $priceList = $(elem).children('.searchResultContent').children('ul.price').children('li');

    let book = {
      // id: $(elem).children('.caption').children('.price-info').children('meta[itemprop=identifier]').prop('content'),
      thumbnail: $(elem).children('.cover-div').children('a').children('img').prop('src'),
      title: $(elem).children('.searchResultContent').children('h2').children('a').prop('title'),
      link: new URL($(elem).children('.searchResultContent').children('h2').children('a').prop('href'), base),
      priceCurrency: 'TWD',
      price: parseFloat($priceList.eq(0).children('span').text()),
      authors: $(elem).children('.searchResultContent').children('p').eq(1).children('a').text().trim().split(/, |,|、|，|／/g).map(author => {
        // 特別分工的作者，改變格式
        const authorSplit = author.split('：');

        if (authorSplit.length > 1) {
          author = `${authorSplit[1]}（${authorSplit[0]}）`;
        }

        return author;
      }),
      publisher: $(elem).children('.searchResultContent').children('p').eq(2).children('a').text(),
      publishDate: $(elem).children('.searchResultContent').children('p').eq(0).text().replace(/(出版日期：)|\s/g, ''),
      about: $(elem).children('.searchResultContent').children('p.info').text(),
    };

    // 有多種價格，則為下載版
    if ($priceList.length > 1) {
      book.nonDrmPrice = parseFloat($priceList.eq(1).children('span').text());
    }

    books[i] = book;
  });

  return books;
}

exports.searchBooks = searchBooks;
