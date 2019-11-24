import { resolve as resolveURL } from 'url';

import fetch from 'node-fetch';
import cheerio from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'kobo' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  // URL encode
  keywords = encodeURIComponent(keywords);
  const base = `https://www.kobo.com/tw/zh/search?fcmedia=Book&Query=${keywords}`;

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
  const $list = $('ul[class=result-items] li');

  let books: Book[] = [];

  // 找不到就是沒這書
  if ($list.length === 0) {
    // console.log('Not found in kobo!');

    return books;
  }

  $list.each((i, elem) => {
    // 從 script elem 拉 JSON data
    const info = JSON.parse(
      $(elem)
        .children('.item-detail')
        .children('script')
        .html() || '{ data: null }'
    ).data;

    // 若有副標題，併入主標題
    let title = info.name;
    if (info.alternativeHeadline) {
      title += ` - ${info.alternativeHeadline}`;
    }

    // 合併作者成一個陣列
    let authors: string[] = [];
    for (let item of info.author) {
      authors = authors.concat(item.name.split('、'));
    }

    // 價格要先檢查是否為免費
    const $priceField = $(elem)
      .children('.item-detail')
      .children('.item-info')
      .children('.price');

    let price = 0;
    if (!$priceField.hasClass('free')) {
      price =
        parseFloat(
          $priceField
            .children('span')
            .children('span')
            .first()
            .text()
            .replace(/NT\$|,|\s/g, '')
        ) || -1;
    }

    books[i] = {
      id: info.isbn,
      // 圖片網址為相對位置，需要 resolve
      thumbnail: resolveURL(base, info.thumbnailUrl),
      title,
      link: info.url,
      priceCurrency: $(elem)
        .children('.item-detail')
        .children('.item-info')
        .children('.price')
        .children('span')
        .children('.currency')
        .text(),
      price,
      about: info.description ? `${info.description} ...` : undefined,
      // publisher
    };

    // 作者群有資料才放
    if (authors.length > 0) {
      books[i].authors;
    }
  });

  return books;
}
