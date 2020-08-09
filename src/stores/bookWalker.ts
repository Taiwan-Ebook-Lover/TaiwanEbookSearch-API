import { resolve as resolveURL } from 'url';

import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import cheerio from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'bookWalker' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  const status = process.env.BOOKWALKER || 'open';
  const proxy = process.env.PROXY;
  const agent = status === 'proxy' && proxy ? new HttpsProxyAgent(proxy) : undefined;

  if (status === 'close') {
    const hrEnd = process.hrtime(hrStart);
    const processTime = getProcessTime(hrEnd);

    return {
      title,
      isOkay: false,
      processTime,
      books: [],
      error: {
        message: 'Bookstore is not open.',
        type: 'bookstore-invalid',
      },
    };
  }

  // URL encode
  keywords = encodeURIComponent(keywords);
  const base = `https://www.bookwalker.com.tw/search?w=${keywords}&m=0&detail=1`;

  const options = {
    method: 'GET',
    compress: true,
    timeout: 10000,
    agent,
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

function _getBooks($: CheerioStatic, base: string) {
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
        let title = $(elem)
          .children('.bookdata')
          .children('h2')
          .children('a')
          .text();
        let subTitle = $(elem)
          .children('.bookdata')
          .children('h3')
          .children('a')
          .text();
        if (subTitle) {
          title += ` / ${subTitle}`;
        }

        // Prepare author name
        const authorRegex = /(?:\s)?\S*\s:\s/g; // Use ` 作者 : `  to speared
        const authorsOriginalStr = $(elem)
          .children('.bookdata')
          .children('.bw_item')
          .children('.writerinfo')
          .children('.writer_data')
          .children('li')
          .text();
        const authorTitle = (authorsOriginalStr.match(authorRegex) || []).map(str => {
          return str.replace(/\s|:/g, '');
        });
        const authorsName = authorsOriginalStr.split(authorRegex).slice(1);

        // Speared author / translators / painters / others(combine to author)
        let authors = [];
        let translators = [];
        let painters = [];

        for (let index in authorTitle) {
          const names = authorsName[index].split('、');
          switch (authorTitle[index]) {
            case '作者':
              authors = names;
              break;
            case '譯者':
              translators = names;
              break;
            case '插畫':
              painters = names;
              break;
            default:
              for (let name of names) {
                authors.push(`${name} (${authorsName[index]})`);
              }
              break;
          }
        }

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
            .data('src'),
          title: title,
          link: resolveURL(
            base,
            $(elem)
              .children('.bookdata')
              .children('h2')
              .children('a')
              .prop('href')
          ),
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
          books[i].authors;
        }

        if (translators.length > 0) {
          books[i].translators;
        }

        if (painters.length > 0) {
          books[i].painters;
        }
      });
  });

  return books;
}
