import cheerio, { CheerioAPI } from 'cheerio';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';

import pkg from 'https-proxy-agent';
const { HttpsProxyAgent } = pkg;

import { Book } from '../interfaces/book.js';
import { Result } from '../interfaces/result.js';
import { getProcessTime } from '../interfaces/general.js';
import { FirestoreBookstore } from '../interfaces/firestoreBookstore.js';

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
  const base = `https://api.like.co/likernft/book/store/search?q=${keywords}`;

  const options = {
    method: 'GET',
    compress: true,
    signal: timeoutSignal(10000),
    agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
    headers: {
      'User-Agent': `Taiwan-Ebook-Search/${process.env.npm_package_version}`,
    },
  };

  return fetch(base, options)
    .then((response) => {
      if (!response.ok) {
        throw response.statusText;
      }

      return response.json();
    })
    .then((data) => {
      // calc process time
      const hrEnd = process.hrtime(hrStart);
      const processTime = getProcessTime(hrEnd);
      const books: Book[] = (data as any).list.map((item: any) => {
        const { iscnId, imageUrl, name, url, minPrice, description, ownerName } = item;
        return {
          id: iscnId,
          thumbnail: imageUrl,
          title: name,
          link: url,
          priceCurrency: 'usd',
          price: minPrice,
          about: description,
          authors: [ownerName],
        };
      });
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
