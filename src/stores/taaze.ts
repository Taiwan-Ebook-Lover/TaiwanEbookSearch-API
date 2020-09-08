import rp from 'request-promise-native';
import cheerio from 'cheerio';

import { HttpsProxyAgent } from 'https-proxy-agent';

import { Book } from '../interfaces/book';
import { Result } from '../interfaces/result';
import { getProcessTime } from '../interfaces/general';
import { FirestoreBookstore } from '../interfaces/firebaseBookstore';

export default ({ proxyUrl, ...bookstore }: FirestoreBookstore, keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  if (!bookstore.isOnline) {
    const hrEnd = process.hrtime(hrStart);
    const processTime = getProcessTime(hrEnd);
    const result: Result = {
      bookstore,
      isOkay: false,
      status: 'Bookstore is offline',
      processTime,
      books: [],
      quantity: 0,
    };

    return result;
  }

  // URL encode
  keywords = encodeURIComponent(keywords);

  const options = {
    uri: `https://www.taaze.tw/rwd_searchResult.html?keyType%5B%5D=1&prodKind=4&catFocus=14&keyword%5B%5D=${keywords}`,
    resolveWithFullResponse: true,
    simple: false,
    gzip: true,
    timeout: 10000,
    agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
  };

  return rp(options)
    .then(response => {
      if (!/^2/.test('' + response.statusCode)) {
        // console.log('Not found or error in taaze!');

        return [];
      }

      const books: Book[] = _getBooks(cheerio.load(response.body));

      // 沒這書就直接傳吧
      if (!books.length) {
        return books;
      } else {
        // 再取得所有書的 info
        return _getBooksInfo(books);
      }
    })
    .then(books => {
      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);
      const result: Result = {
        bookstore,
        isOkay: true,
        status: 'Crawler success.',
        processTime,
        books,
        quantity: books.length,
      };

      return result;
    })
    .catch(error => {
      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      console.log(error.message);

      const result: Result = {
        bookstore,
        isOkay: false,
        status: 'Crawler failed.',
        processTime,
        books: [],
        quantity: 0,
        error: error.message,
      };

      return result;
    });
};

// 取得書籍們的資料
function _getBooksInfo(books: Book[] = []) {
  // 等每本書都叫到資料再繼續
  return Promise.all(
    books.map(book => {
      return _getBookInfo(book.id);
    })
  ).then(infos => {
    for (let i in books) {
      books[i].title = infos[i].booktitle;
      books[i].about = infos[i].bookprofile.replace(/\r/g, '');
      books[i].publisher = infos[i].publisher;
      books[i].publishDate = infos[i].publishDate;
      books[i].price = parseFloat(infos[i].saleprice) || -1;

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
function _getBooks($: CheerioStatic) {
  const $list = $('#listView').children('.media');

  let books: Book[] = [];

  if ($list.length === 0) {
    // console.log('Not found in taaze!');

    return books;
  }

  $list.each((i, elem) => {
    // 先取得 id，部分資料需另叫 API 處理
    const id = $(elem).prop('rel');

    books[i] = {
      id,
      thumbnail: `http://media.taaze.tw/showLargeImage.html?sc=${id}`,
      title: id, //info.booktitle
      link: `https://www.taaze.tw/goods/${id}.html`,
      priceCurrency: 'TWD',
      // price: saleprice ,
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
    uri: 'https://www.taaze.tw/new_ec/rwd/lib/searchbookAgent.jsp',
    qs: {
      prodId: id,
    },
    json: true,
  };

  return rp(options).then(info => {
    return info[0];
  });
}
