import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';

import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;

import { Book } from '../interfaces/book.js';
import { Result } from '../interfaces/result.js';
import { getProcessTime } from '../interfaces/general.js';
import { FirestoreBookstore } from '../interfaces/firestoreBookstore.js';

export default (
  { proxyUrl, ...bookstore }: FirestoreBookstore,
  keywords = '',
  userAgent: string,
) => {
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
  const rootURL = `https://play.google.com`;
  const base = `${rootURL}/store/search?q=${keywords}&c=books&authuser=0&gl=tw&hl=zh-tw`;

  const options = {
    method: 'GET',
    compress: true,
    signal: timeoutSignal(10000),
    agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
    headers: {
      'User-Agent': `${userAgent}`,
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
      return _getBooks(cheerio.load(body), rootURL, base);
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
function _getBooks($: cheerio.CheerioAPI, rootURL: string, base: string) {
  const $list = $('div[role=listitem]');

  const books: Book[] = [];

  // 找不到就是沒這書
  if (!$list.length) {
    console.log('Not found in Play Store!');
    return books;
  }

  $list.each((_i, elem) => {
    const $bookElem = $(elem);

    // 透過語意化連結取得書籍頁面 URL
    const $link = $bookElem.find('a[href*="/store/books/details"]');
    const href = $link.attr('href') ?? '';

    if (!href) return;

    const linkUrl = new URL(href, base);
    const id = linkUrl.searchParams.get('id');

    if (!id) return;

    // 取得書名：優先使用 div[title]，備用 img alt 屬性
    let title = $bookElem.find('div[title]').attr('title') ?? '';
    if (!title) {
      const alt = $bookElem.find('img').attr('alt') ?? '';
      title = alt.replace(/^「|」圖示圖片$/g, '');
    }

    // 解析價格：透過 aria-label 中的金額資訊
    let price: number = -1;
    const $priceSpan = $bookElem.find('span[aria-label*="$"]');

    if ($priceSpan.length > 0) {
      const ariaLabel = $priceSpan.attr('aria-label') ?? '';
      const priceMatches = ariaLabel.match(/\$[\d,.]+/g);

      if (priceMatches) {
        price = priceMatches
          .map((match) => parseFloat(match.replace(/[^\d.]/g, '')))
          .sort((a, b) => a - b)[0];
      } else {
        const cleaned = $priceSpan
          .text()
          .replace(/[^\d.]/g, '')
          .trim();
        price = parseFloat(cleaned) || -1;
      }
    } else {
      // 備用方案：遍歷 span 尋找含有 $ 符號的文字
      $bookElem.find('span').each((_j, span) => {
        const text = $(span).text();
        const priceMatch = text.match(/\$[\d,.]+/);
        if (priceMatch) {
          price = parseFloat(priceMatch[0].replace(/[^\d.]/g, ''));
          return false; // 中斷 each 迴圈
        }
      });
    }

    // 設定書籍網址的語言與國家
    linkUrl.searchParams.set('gl', 'tw');
    linkUrl.searchParams.set('hl', 'zh-tw');

    const book: Book = {
      id,
      thumbnail: `${rootURL}/books/publisher/content/images/frontcover/${id}?fife=w256-h256`,
      title,
      link: linkUrl.href,
      priceCurrency: 'TWD',
      price,
    };

    books.push(book);
  });

  return books;
}
