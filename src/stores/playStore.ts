import rp from 'request-promise-native';
import cheerio from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'playStore' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  // URL encode
  keywords = encodeURIComponent(keywords);
  const base = `https://play.google.com/store/search?q=${keywords}&c=books&authuser=0&gl=tw&hl=zh-tw`;

  const options = {
    method: 'POST',
    uri: base,
    resolveWithFullResponse: true,
    simple: false,
    gzip: true,
    timeout: 10000,
  };

  return rp(options)
    .then(response => {
      if (!/^2/.test('' + response.statusCode)) {
        // console.log('Not found or error in Play Store!');

        return [];
      }

      return _getBooks(cheerio.load(response.body), base);
    })
    .then(books => {
      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      return {
        title,
        isOkay: true,
        processTime,
        books,
      };
    })
    .catch(error => {
      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      console.log(error.message);

      return {
        title,
        isOkay: false,
        processTime,
        books: [],
        error,
      };
    });
};

// parse 找書
function _getBooks($: CheerioStatic, base: string) {
  const $list = $('.card-content');

  let books: Book[] = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in Play Store!');

    return books;
  }

  $list.each((i, elem) => {
    // 先抓作者群字串（可能沒有）
    let authors: string = $(elem)
      .children('.details')
      .children('.subtitle-container')
      .children('a.author')
      .prop('title');

    // resolve book's link
    let linkUrl = new URL(
      $(elem)
        .children('a')
        .prop('href'),
      base
    );

    // 設定書籍網址的語言與國家
    linkUrl.searchParams.set('gl', 'tw');
    linkUrl.searchParams.set('hl', 'zh-tw');

    let book: Book = {
      // id: $(elem).children('.caption').children('.price-info').children('meta[itemprop=identifier]').prop('content'),
      thumbnail: $(elem)
        .children('.cover')
        .children('.cover-image-container')
        .children('.cover-outer-align')
        .children('.cover-inner-align')
        .children('img')
        .data('cover-small'),
      title: $(elem)
        .children('.details')
        .children('a.title')
        .prop('title'),
      link: linkUrl.href,
      priceCurrency: 'TWD',
      price:
        parseFloat(
          $(elem)
            .children('.details')
            .children('.subtitle-container')
            .children('.price-container')
            .children('.is-price-tag')
            .children('button.price')
            .children('.display-price')
            .text()
            .replace(/\$|,/g, '')
            .replace(/免費/, '0')
        ) || -1,
      about: $(elem)
        .children('.details')
        .children('.description')
        .text(),
    };

    // 有作者群，才放
    if (authors) {
      book.authors = authors.split(/,|、/);
    }

    books[i] = book;
  });

  return books;
}
