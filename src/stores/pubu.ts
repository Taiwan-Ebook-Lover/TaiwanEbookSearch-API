import { resolve as resolveURL } from 'url';

import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import cheerio from 'cheerio';

import { Book } from '../interfaces/stores';
import { getProcessTime } from '../interfaces/general';

const title = 'pubu';

export default (keywords = '') => {
  // start calc process time
  const hrStart = process.hrtime();

  // if bookstore is close
  const status = process.env.PUBU || 'open';
  if (status !== 'open') {
    const hrEnd = process.hrtime(hrStart);
    const processTime = getProcessTime(hrEnd);

    return {
      title,
      isOkay: false,
      processTime,
      books: [],
      error: {
        message: 'Bookstore is not open.',
        type: 'bookstore-invalid'
      },
    }
  }

  // URL encode
  keywords = encodeURIComponent(keywords);
  const base = `https://www.pubu.com.tw/search?q=${keywords}`;

  const options = {
    method: 'GET',
    compress: true,
    timeout: 10000,
    agent: process.env.PROXY ? new HttpsProxyAgent(process.env.PROXY) : undefined,
    headers: {
      'User-Agent': 'Taiwan-Ebook-Search/0.1',
    },
  };

  return fetch(base, options)
    .then(response => {
      if (!response.ok) {
        return response.text();
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
  const $list = $('#search-list-content').children('article');

  let books: Book[] = [];

  if (!$list.length) {
    // console.log('Not found in Pubu!');

    return books;
  }

  $list.each((i, elem) => {
    // Prepare price (some books has another price for no-DRM version)
    const $priceList = $(elem)
      .children('.searchResultContent')
      .children('ul.price')
      .children('li');

    const price = parseFloat(
      $priceList
        .eq(0)
        .children('span')
        .text()
    );

    let book: Book = {
      // id: $(elem).children('.caption').children('.price-info').children('meta[itemprop=identifier]').prop('content'),
      thumbnail: $(elem)
        .children('.cover-div')
        .children('a')
        .children('img')
        .prop('src'),
      title: $(elem)
        .children('.searchResultContent')
        .children('h2')
        .children('a')
        .prop('title'),
      link: resolveURL(
        base,
        $(elem)
          .children('.searchResultContent')
          .children('h2')
          .children('a')
          .prop('href')
      ),
      priceCurrency: 'TWD',
      price: price >= 0 ? price : -1,
      authors: $(elem)
        .children('.searchResultContent')
        .children('p')
        .eq(1)
        .children('a')
        .text()
        .trim()
        .split(/, |,|、|，|／/g)
        .map(author => {
          const authorSplit = author.split('：');

          if (authorSplit.length > 1) {
            author = `${authorSplit[1]}（${authorSplit[0]}）`;
          }

          return author;
        }),
      publisher: $(elem)
        .children('.searchResultContent')
        .children('p')
        .eq(2)
        .children('a')
        .text(),
      publishDate: $(elem)
        .children('.searchResultContent')
        .children('p')
        .eq(0)
        .text()
        .replace(/(出版日期：)|\s/g, ''),
      about: $(elem)
        .children('.searchResultContent')
        .children('p.info')
        .text(),
    };

    // Add non-DRM price
    if ($priceList.length > 1) {
      book.nonDrmPrice = parseFloat(
        $priceList
          .eq(1)
          .children('span')
          .text()
      );
    }

    books[i] = book;
  });

  return books;
}
