import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';

import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;

import { Book } from '../interfaces/book.js';
import { Result } from '../interfaces/result.js';
import { getProcessTime } from '../interfaces/general.js';
import { FirestoreBookstore } from '../interfaces/firestoreBookstore.js';

// 使用 Googlebot UA 繞過 Kobo 的 Cloudflare 保護，僅存取公開的搜尋結果。
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

export default (
  { proxyUrl, ...bookstore }: FirestoreBookstore,
  keywords = '',
  _userAgent: string,
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
  const base = `https://www.kobo.com/tw/zh/search?fcmedia=Book&Query=${keywords}`;

  const options = {
    method: 'GET',
    compress: true,
    signal: timeoutSignal(10000),
    agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
    headers: {
      'User-Agent': GOOGLEBOT_UA,
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
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
  const books: Book[] = [];

  // 僅針對 Desktop 版的卡片容器 — Next.js 會同時渲染隱藏的 Mobile 版卡片，這會導致資料重複。
  $('[data-testid="book-card-desktop"]').each((_i, card) => {
    const $card = $(card);

    // ── 標題與連結 ─────────────────────────────────────────────────────────
    const $anchor = $card.find('a[data-testid="title"]').first();
    const title = $anchor.text().trim();
    if (!title) return;

    const href = $anchor.attr('href') ?? '';
    const link = new URL(href, base).toString();

    // ── 封面圖片 ──────────────────────────────────────────────────────────
    const $coverContainer = $card.find('[data-testid="book-cover-container"]');
    let thumbnail =
      $coverContainer.find('img').attr('src') ??
      $coverContainer.find('picture source').first().attr('srcset') ??
      undefined;
    if (thumbnail) {
      thumbnail = new URL(thumbnail, base).toString();
    }

    // ── 作者 ──────────────────────────────────────────────────────────────
    const authors: string[] = [];
    $card.find('[data-testid="authors"] a[data-testid="book-attribute-link"]').each((_j, el) => {
      const name = $(el).text().trim();
      if (name) authors.push(name);
    });

    // ── 價格 ──────────────────────────────────────────────────────────────
    // Kobo 將價格渲染在 data-testid 以 "-pricing-price-value" 結尾的元素中。文字格式為：「Sale Price: NT$350.00 TWD」。
    // 解析前需移除前綴與貨幣後綴。
    let price: number = -1;
    const raw = $card.find('[data-testid$="-pricing-price-value"]').first().text().trim();
    if (raw === '免費' || raw.toLowerCase().includes('free')) {
      price = 0;
    } else {
      // 只保留數字和小數點，不管幣別是 TWD、USD 或其他格式，都能正確提取價格數字。
      const cleaned = raw.replace(/[^\d.]/g, '').trim();
      const numeric = parseFloat(cleaned);
      if (!isNaN(numeric)) price = numeric;
    }

    const book: Book = {
      title,
      link,
      thumbnail,
      priceCurrency: 'TWD',
      price,
    };

    if (authors.length > 0) {
      book.authors = authors;
    }

    books.push(book);
  });

  return books;
}
