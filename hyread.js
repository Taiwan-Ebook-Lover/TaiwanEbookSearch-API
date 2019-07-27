const rp = require('request-promise-native');
const cheerio = require('cheerio');
const url = require('url');
const marky = require('marky');

const title = 'hyread';

function searchBooks(keywords = '') {
  // start calc process time
  marky.mark('search');

  // URL encode
  // keywords = encodeURIComponent(keywords);

  const base = `https://ebook.hyread.com.tw/searchList.jsp`;

  const options = {
    uri: base,
    qs: {
      search_field: 'FullText',
      MZAD: 0,
      search_input: keywords,
    },
    resolveWithFullResponse: true,
    simple: false,
    gzip: true,
    timeout: 10000,
  };

  return rp(options)
    .then(response => {
      if (!/^2/.test('' + response.statusCode)) {
        // console.log('Not found or error in hyread!');

        return [];
      }

      return _getBooks(cheerio.load(response.body), base);
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
function _getBooks($, base) {
  $rows = $('table.picview')
    .children('tbody')
    .children('tr');

  let books = [];

  // 找不到就是沒這書
  if ($rows.length === 0) {
    console.log('Not found in hyread!');

    return books;
  }

  // 每列都有數本
  $rows.each((rowIndex, columns) => {
    // 每本的內容
    $(columns)
      .children('td')
      .each((i, elem) => {
        // 有聲書會多一層結構
        $linkBlock = $(elem)
          .children('div.voicebg')
          .children('a');

        if ($linkBlock.length === 0) {
          $linkBlock = $(elem).children('a');
        }

        // 無售價資訊的排除掉
        const price =
          parseFloat(
            $(elem)
              .children('span')
              .children('b')
              .text()
              .replace(/\D*/g, '')
          ) || -1;

        if (Number.isNaN(price)) {
          return;
        }

        const book = {
          id: $(elem)
            .children('h3')
            .children('a')
            .prop('href')
            .replace(/bookDetail.jsp\?id=/, ''),
          thumbnail: $linkBlock.children('img').prop('src'),
          title: $(elem)
            .children('h3')
            .children('a')
            .text(),
          link: url.resolve(base, $linkBlock.prop('href')),
          priceCurrency: 'TWD',
          price,
          // about: ,
        };

        books.push(book);
      });
  });

  return books;
}

exports.searchBooks = searchBooks;
