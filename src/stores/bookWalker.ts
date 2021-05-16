import timeoutSignal from 'timeout-signal';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import cheerio, { CheerioAPI } from 'cheerio';

import { Book } from '../interfaces/book';
import { getProcessTime } from '../interfaces/general';
import { FirestoreBookstore } from '../interfaces/firestoreBookstore';

const title = 'bookWalker' as const;

export default ({ proxyUrl, ...bookstore }: FirestoreBookstore, keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  if (!bookstore.isOnline) {
    const hrEnd = process.hrtime(hrStart);
    const processTime = getProcessTime(hrEnd);
    const result = {
      bookstore,
      status: 'Bookstore is offline',
      quantity: 0,
      title,
      isOkay: false,
      processTime,
      books: [],
      error: {
        message: 'Bookstore is not open.',
        type: 'bookstore-invalid',
      }
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
      return _getBooks(cheerio.load(body), base);
    })
    .then(books => {
      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);

      return {
        bookstore,
        status: 'Crawler success.',
        quantity: books.length,
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
        bookstore,
        status: 'Crawler failed.',
        quantity: 0,
        title,
        isOkay: false,
        processTime,
        books: [],
        error,
      };
    });
};

function _getBooks($: CheerioAPI, base: string) {
  const books: Book[] = [];
  const $categories = $('.listbox');

  $categories.each((i, elem) => {
    // Filter wrong element
    if (!$(elem).children('.listbox_title').length) {
      return;
    }

    $(elem)
      .children('.bookdesc')
      .each((i, elem) => {
        // Combine title and sub-title
        let title = $(elem).children('.bookdata').children('h2').children('a').text();
        let subTitle = $(elem).children('.bookdata').children('h3').children('a').text();
        if (subTitle) {
          title += ` / ${subTitle}`;
        }

        // Prepare author name
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
          .map(str => str.split(' : '))
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

        // Prepare price
        const price = parseFloat(
          $(elem)
            .children('.bookdata')
            .children('.bw_item')
            .children('.writerinfo')
            .children('h4')
            .children('span')
            .text()
            .replace(/\D/g, '')
        );

        books[i] = {
          id: $(elem)
            .children('.bookdata')
            .children('h2')
            .children('a')
            .prop('href')
            .replace('/product/', ''),
          thumbnail: $(elem)
            .children('.bookcover')
            .children('.bookitem')
            .children('a')
            .children('img')
            .data('src') as string,
          title: title,
          link: new URL(
            $(elem).children('.bookdata').children('h2').children('a').prop('href'),
            base
          ).toString(),
          priceCurrency: 'TWD',
          price: price >= 0 ? price : -1,
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
                .text()
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
