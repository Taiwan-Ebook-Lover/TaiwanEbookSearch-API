import timeoutSignal from 'timeout-signal';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import cheerio, { CheerioAPI } from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'kobo' as const;

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  const status = process.env.KOBO || 'open';
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
  const base = `https://www.kobo.com/tw/zh/search?fcmedia=Book&Query=${keywords}`;

  const options = {
    method: 'GET',
    compress: true,
    signal: timeoutSignal(10000),
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

function _getBooks($: CheerioAPI, base: string) {
  const $list = $('ul[class=result-items] li');

  let books: Book[] = [];

  if (!$list.length) {
    // console.log('Not found in kobo!');

    return books;
  }

  $list.each((i, elem) => {
    // Get information from the script element
    const info = JSON.parse(
      $(elem).children('.item-detail').children('script').html() || '{ data: null }'
    ).data;

    // Combine title and sub-title
    let title = info.name;
    if (info.alternativeHeadline) {
      title += ` - ${info.alternativeHeadline}`;
    }

    // Prepare authors name
    const authors = (
      eval(
        $(elem)
          .children('.item-detail')
          .children('.item-info')
          .children('.contributors')
          .children('.synopsis-contributors')
          .children('.synopsis-text')
          .children('.contributor-name')
          .data('track-info') as string
      )?.author ?? ''
    ).split('、');

    // Check if price is `free`
    const $priceField = $(elem).children('.item-detail').children('.item-info').children('.price');

    let price = 0;
    if (!$priceField.hasClass('free')) {
      price = parseFloat(
        $priceField
          .children('span')
          .children('span')
          .first()
          .text()
          .replace(/NT\$|,|\s/g, '')
      );
    }

    books[i] = {
      id: info.isbn,
      thumbnail: new URL(info.thumbnailUrl, base).toString(),
      title,
      link: info.url,
      priceCurrency: $(elem)
        .children('.item-detail')
        .children('.item-info')
        .children('.price')
        .children('span')
        .children('.currency')
        .text(),
      price: price >= 0 ? price : -1,
      about: info.description ? `${info.description} ...` : undefined,
      // publisher
    };

    if (authors.length > 0) {
      books[i].authors = authors;
    }
  });

  return books;
}
