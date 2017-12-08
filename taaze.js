const rp = require('request-promise-native');
const cheerio = require('cheerio');
const url = require('url');

function searchBooks(keywords = '') {
  // URL encode
  keywords = encodeURIComponent(keywords);

  const options = {
    uri: `https://www.taaze.tw/search_go.html?keyword%5B%5D=${keywords}&keyType%5B%5D=0&prodKind=4&prodCatId=141`,
    resolveWithFullResponse: true,
    simple: false,
  };

  return rp(options).then(response =>{
    if (!(/^2/.test('' + response.statusCode))) {
      // console.log('Not found or error in taaze!');

      return [];
    }

    const books = _getBooks(cheerio.load(response.body));

    // 沒這書就直接傳吧
    if (books.length === 0) {
      return books;
    } else {
      // 再取得所有書的 info
      return _getBooksInfo(books);
    }
  }).then(books => {
    return books;
  });
}

// 取得書籍們的資料
function _getBooksInfo(books = []) {
  // 等每本書都叫到資料再繼續
  return Promise.all(books.map(book => {
    return _getBookInfo(book.id);
  })).then(infos => {
    for (let i in books) {
      books[i].title = infos[i].booktitle;
      books[i].about = infos[i].bookprofile.replace(/\r/g, '');
      books[i].publisher = infos[i].publisher;
      books[i].publishDate = infos[i].publishDate;

      // 作者群有資料才放
      if (infos[i].authors) {
        books[i].authors;
      }

      // 有翻譯者才放
      if (infos[i].translator) {
        books[i].translator = infos[i].translator;
        books[i].translators = [infos[i].translator];
      }
    }

    return books;
  });
}

// parse 找書
function _getBooks($) {
  $list = $('.searchresult_row');

  let books = [];

  if ($list.length === 0) {
    // console.log('Not found in taaze!');

    return books;
  }

  $list.each((i, elem) => {
    // 先取得 id，部分資料需另叫 API 處理
    const id = $(elem).children('.two').children('ul').prop('rel');

    // 價格可能有折扣資訊
    const $priceBlock = $(elem).children('.two').children('ul').children('li').eq(4).children('span').eq(1).children('span');
    const price = parseFloat($($priceBlock).eq($priceBlock.length - 1).text().replace(/\$|,/g, ''));

    books[i] = {
      id,
      thumbnail: $(elem).children('.one').css('background').replace(/.*\s?url\([\'\"]?/, '').replace(/[\'\"]?\).*/, ''),
      // title: info.booktitle,
      link: $(elem).children('.two').children('ul').children('li[class=linkC]').children('a').prop('href'),
      priceCurrency: 'TWD',
      price,
      // about: info.bookprofile,
      // publisher: info.publisher,
      // publishDate: info.publishdate,
      // authors: info.author,
    };
  });

  return books;
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
