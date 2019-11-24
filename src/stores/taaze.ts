import fetch from 'node-fetch';
import cheerio from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'taaze';

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  // URL encode
  keywords = encodeURIComponent(keywords);
  const base = `https://www.taaze.tw/rwd_searchResult.html?keyType%5B%5D=1&prodKind=4&catFocus=14&keyword%5B%5D=${keywords}`;

  const options = {
    method: 'GET',
    compress: true,
    timeout: 10000,
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

      if (!books.length) {
        return books;
      }

      return _getBooksInfo(books);
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

function _getBooksInfo(books: Book[] = []) {
  // Get detail of each book from API
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

      if (infos[i].authors) {
        books[i].authors;
      }

      if (infos[i].translator) {
        books[i].translator = infos[i].translator;
        books[i].translators = [infos[i].translator];
      }
    }

    return books;
  });
}

function _getBooks($: CheerioStatic) {
  const $list = $('#listView').children('.media');

  let books: Book[] = [];

  if (!$list.length) {
    // console.log('Not found in taaze!');

    return books;
  }

  $list.each((i, elem) => {
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

function _getBookInfo(id = '') {
  const url = `https://www.taaze.tw/new_ec/rwd/lib/searchbookAgent.jsp?prodId=${id}`;

  const options = {
    method: 'GET',
    compress: true,
    timeout: 10000,
  };

  return fetch(url, options)
    .then(response => response.json())
    .then(info => {
      return info[0];
    });
}
