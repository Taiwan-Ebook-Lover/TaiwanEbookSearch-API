import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';

import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;

import { Book } from '../interfaces/book.js';
import { Result } from '../interfaces/result.js';
import { getProcessTime } from '../interfaces/general.js';
import { FirestoreBookstore } from '../interfaces/firestoreBookstore.js';

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
  const base = `https://www.bookwalker.com.tw/search?w=${keywords}&m=0&detail=1`;

  const options = {
    method: 'GET',
    compress: true,
    signal: timeoutSignal(10000),
    agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
    headers: {
      'User-Agent': `Taiwan-Ebook-Search/${process.env.npm_package_version}`,
    },
  };

  return fetch(base, options)
    .then((response) => {
      if (!response.ok) {
        throw response.statusText;
      }

      return response.text();
    })
    .then((body) => {
      return _getBooks(cheerio.load(body), base);
    })
    .then((books) => {
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
    .catch((error) => {
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

// parse 找書
function _getBooks($: cheerio.CheerioAPI, base: string) {
  let books: Book[] = [];

  const $categories = $('.listbox');

  $categories.each((i, elem) => {
    if (!$(elem).children('.listbox_title').length) {
      return;
    }

    $(elem)
      .children('.bookdesc')
      .each((i, elem) => {
        let title = $(elem).children('.bookdata').children('h2').children('a').text();
        let subTitle = $(elem).children('.bookdata').children('h3').children('a').text();
        if (subTitle) {
          title += ` / ${subTitle}`;
        }

        const authors: string[] = [];
        const translators: string[] = [];
        const painters: string[] = [];

        $(elem)
          .children('.bookdata')
          .children('.bw_item')
          .children('.writerinfo')
          .children('.writer_data')
          .children('li')
          .map((i, el) => $(el).text())
          .toArray()
          .map((str) => str.split(' : '))
          .forEach(([authorTitle, authorName]) => {
            switch (authorTitle) {
              case '作者':
                authors.push(authorName);
                break;
              case '譯者':
                translators.push(authorName);
                break;
              case '插畫':
                painters.push(authorName);
                break;
              default:
                authors.push(`${authorName} (${authorTitle})`);
                break;
            }
          });

        books[i] = {
          id: (
            $(elem).children('.bookdata').children('h2').children('a').prop('href') ?? ''
          ).replace('/product/', ''),
          thumbnail: $(elem)
            .children('.bookcover')
            .children('.bookitem')
            .children('a')
            .children('img')
            .data('src') as string,
          title: title,
          link: new URL(
            $(elem).children('.bookdata').children('h2').children('a').prop('href') ?? '',
            base,
          ).toString(),
          priceCurrency: 'TWD',
          price:
            parseFloat(
              $(elem)
                .children('.bookdata')
                .children('.bw_item')
                .children('.writerinfo')
                .children('h4')
                .children('span')
                .text()
                .replace(/\D/g, ''),
            ) || -1,
          about: $(elem)
            .children('.bookdata')
            .children('.topic_content')
            .children('.bookinfo')
            .children('h4')
            .text()
            .concat(
              $(elem)
                .children('.bookdata')
                .children('.topic_content')
                .children('.bookinfo')
                .children('h5')
                .children('span')
                .text(),
            ),
          // publisher:,
        };

        if (authors.length > 0) {
          books[i].authors = authors;
        }

        if (translators.length > 0) {
          books[i].translators = translators;
        }

        if (painters.length > 0) {
          books[i].painters = painters;
        }
      });
  });

  return books;
}
