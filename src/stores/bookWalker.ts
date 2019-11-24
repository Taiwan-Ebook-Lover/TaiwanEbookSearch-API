import { resolve as resolveURL } from 'url';

import fetch from 'node-fetch';
import cheerio from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'bookWalker' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  // URL encode
  keywords = encodeURIComponent(keywords);
  const base = `https://www.bookwalker.com.tw/search?w=${keywords}&m=0&detail=1`;

  const options = {
    method: 'GET',
    compress: true,
    timeout: 10000,
    headers: {
      'User-Agent': 'Taiwan-Ebook-Search/0.0.2',
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

// parse 找書
function _getBooks($: CheerioStatic, base: string) {
  // 分類優先排序設定

  const $categories = $('.listbox');

  const books: Book[] = [];

  $categories.each((i, elem) => {
    // 過濾非書內容之元素
    if (!$(elem).children('.listbox_title').length) {
      return;
    }

    $(elem)
      .children('.bookdesc')
      .each((i, elem) => {
        // 若有副標題，併入主標題
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
            $(elem)
              .children('.bookdata')
              .children('h2')
              .children('a')
              .prop('href')
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
