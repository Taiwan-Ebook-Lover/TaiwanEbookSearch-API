const rp = require('request-promise-native');
const cheerio = require('cheerio');
const url = require('url');

function searchBooks(keywords = '') {
  // URL encode
  keywords = encodeURIComponent(keywords);

  const options = {
    uri: 'https://www.taaze.tw/search_go.html',
    qs: {
      'keyword%5B%5D': keywords,
      'keyType%5B%5D': 0,
      prodKind: 4,
      prodCatId: 141,
    },
    transform: (body) => {
      return cheerio.load(body);
    },
  };

  return rp(options).then($ => {
    let books = [];

    $('.searchresult_row').each((i, elem) => {
      // 先取得 id，部分資料需另叫 API 處理
      const id = $(elem).children('.two').children('ul').prop('rel');

      books[i] = {
        id,
        thumbnail: $(elem).children('.one').css('background').replace(/.*\s?url\([\'\"]?/, '').replace(/[\'\"]?\).*/, ''),
        // title: info.booktitle,
        link: $(elem).children('.two').children('ul').children('li[class=linkC]').children('a').prop('href'),
        priceCurrency: 'TWD',
        price: $(elem).children('.two').children('ul').children('li').eq(4).children('span').eq(1).children('span').eq(1).text(),
        // about: info.bookprofile,
        // publisher: info.publisher,
        // publishDate: info.publishdate,
        // authors: info.author,
      };
    });

    // 讓 then 之後還能吃到 books
    this.books = books;

    // 等每本書都叫到資料再繼續
    return Promise.all(books.map(book => {
      return _getBookInfo(book.id);
    }));
  }).then(infos => {
    const books = this.books;

    for (let i in books) {
      books[i].title = infos[i].booktitle;
      books[i].about = infos[i].bookprofile.replace(/\r/g, '');
      books[i].publisher = infos[i].publisher;
      books[i].publishDate = infos[i].publishDate;
      books[i].authors = infos[i].authors;

      // 有翻譯者才放
      if (infos[i].translator) {
        books[i].translator = infos[i].translator;
      }
    }

    return books;
  });
}

// 單本書部分資料
function _getBookInfo(id = '') {
  const options = {
    uri: 'https://www.taaze.tw/beta/searchbookAgent.jsp',
    qs: {
      prodId: id
    },
    json: true,
  };

  return rp(options).then(info => {
    return info[0];
  });
}

exports.searchBooks = searchBooks;
