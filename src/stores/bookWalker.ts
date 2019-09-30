import { resolve as resolveURL } from 'url';

import rp from 'request-promise-native';
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
    uri: base,
    headers: {
      'User-Agent': 'Taiwan-Ebook-Search/0.0.2',
    },
    resolveWithFullResponse: true,
    simple: false,
    gzip: true,
    timeout: 10000,
  };

  return rp(options)
    .then(response => {
      if (!/^2/.test('' + response.statusCode)) {
        // console.log('Not found or error in bookwalker!');

        return [];
      }

      return _getBooks(cheerio.load(response.body), base);
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
  const categoryTitle = ['一般．實用書', '文學．小說', '雜誌', '漫畫', '輕小說', '日文書'];
  let categories: Book[][] = [[], [], [], [], [], []];

  const $categories = $('.listbox');

  $categories.each((i, elem) => {
    // 過濾非書內容之元素
    if ($(elem).children('.listbox_title').length === 0) {
      return;
    }

    let books: Book[] = [];

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

    // 按分類優先排序擺放
    const categoryIndex = categoryTitle.indexOf(
      $(elem)
        .children('.listbox_title')
        .children('.bw_title')
        .text()
        .trim()
    );
    categories[categoryIndex] = books;
  });

  let books: Book[] = [];

  // 展開各分類書籍
  for (let category of categories) {
    books.push(...category);
  }

  return books;
}
