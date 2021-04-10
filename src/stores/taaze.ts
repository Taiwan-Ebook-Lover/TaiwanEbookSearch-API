import cheerio from 'cheerio';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';

import { HttpsProxyAgent } from 'https-proxy-agent';

import { Book } from '../interfaces/book';
import { Result } from '../interfaces/result';
import { getProcessTime } from '../interfaces/general';
import { FirestoreBookstore } from '../interfaces/firebaseBookstore';
import { response } from 'express';

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
  const base = `https://www.taaze.tw/rwd_searchResult.html?keyType%5B%5D=1&prodKind=4&catFocus=14&keyword%5B%5D=${keywords}`;

  const options = {
    method: 'GET',
    compress: true,
    signal: timeoutSignal(10000),
    agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
    headers: {
      'User-Agent': 'Taiwan-Ebook-Search/0.1',
    },
  };

  return fetch(base, options)
    .then(response => {
      if (!response.ok) {
        throw response.statusText;
      }

      return response.text();
    })
    .then(body => {
      const books: Book[] = _getBooks(cheerio.load(body));

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
function _getBooks($: cheerio.Root) {
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
  const base = `https://www.taaze.tw/new_ec/rwd/lib/searchbookAgent.jsp?prodId=${id}`;

  const options = {
    method: 'GET',
    compress: true,
    signal: timeoutSignal(10000),
    headers: {
      'User-Agent': 'Taiwan-Ebook-Search/0.1',
    },
  };

  return fetch(base, options)
    .then(response => {
      return response.json();
    })
    .then(info => {
      return info[0];
    });
}
