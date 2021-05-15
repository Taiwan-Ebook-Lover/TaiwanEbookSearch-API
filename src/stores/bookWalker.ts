import cheerio, { CheerioAPI } from 'cheerio';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';

import { resolve as resolveURL } from 'url';
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

// parse 找書
function _getBooks($: CheerioAPI, base: string) {
  // 分類優先排序設定
  let books: Book[] = [];

  const $categories = $('.listbox');

  $categories.each((i, elem) => {
    // 過濾非書內容之元素
    if ($(elem).children('.listbox_title').length === 0) {
      return;
    }

    $(elem)
      .children('.bookdesc')
      .each((i, elem) => {
        // 若有副標題，併入主標題
        let title = $(elem).children('.bookdata').children('h2').children('a').text();
        let subTitle = $(elem).children('.bookdata').children('h3').children('a').text();
        if (subTitle) {
          title += ` / ${subTitle}`;
        }

        // 分割作者群字串
        const authorRegex = /(?:\s)?\S*\s:\s/g; // 取得 ` 作者 : ` 字樣以做分割
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

        // 準備各類作者包
        let authors = [];
        let translators = [];
        let painters = [];

        // 依照作者 title 分包
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
              // 未知類型標記後納入「作者」中
              for (let name of names) {
                authors.push(`${name} (${authorsName[index]})`);
              }
              break;
          }
        }

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
            .prop('src'),
          title: title,
          link: resolveURL(
            base,
            $(elem).children('.bookdata').children('h2').children('a').prop('href')
          ),
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
                .replace(/\D/g, '')
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
                .text()
            ),
          // publisher:,
        };

        // 作者群有資料才放
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
