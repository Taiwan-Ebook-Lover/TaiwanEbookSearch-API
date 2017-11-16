const rp = require('request-promise-native');
const cheerio = require('cheerio');
const url = require('url');

function searchBooks(keywords = '') {
  // URL encode
  keywords = encodeURIComponent(keywords);
  const base = `https://www.kobo.com/tw/zh/search`;

  const options = {
    uri: base,
    qs: {
      Query: keywords
    },
    transform: (body) => {
      return cheerio.load(body);
    }
  };

  return rp(options).then($ => {
    let books = [];

    $('ul[class=result-items] li').each((i, elem) => {
      const subtitle = $(elem).children('.item-detail').children('.item-info').children('.subtitle').children('a').text();
      let title = $(elem).children('.item-detail').children('.item-info').children('.title').children('a').text();

      // 若有副標題，併入主標題
      if (subtitle) {
        title += ` - ${subtitle}`;
      }

      books[i] = {
        // 圖片網址為相對位置，需要 resolve
        thumbnail: url.resolve(base, $(elem).children('.item-detail').children('.image-column').children('.item-image').children('a').children('.image-container').children('img').prop('src')),
        title,
        link: $(elem).children('.item-detail').children('.item-info').children('.title').children('a').prop('href'),
        priceCurrency: $(elem).children('.item-detail').children('.item-info').children('.price').children('span').children('.currency').text(),
        price: parseFloat($(elem).children('.item-detail').children('.item-info').children('.price').children('span').children('span').first().text().replace('NT$', '')),
        about: `${$(elem).children('.item-detail').children('.item-info').children('.synopsis').children('.synopsis-text').text()} ...`,
        // publisher
        authors: $(elem).children('.item-detail').children('.item-info').children('.contributor-list').children('.visible-contributors').children('a').text().split('、'),
        // authors
      };

    });

    return books;
  });
}

exports.searchBooks = searchBooks;
