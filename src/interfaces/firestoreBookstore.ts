import { Bookstore } from './bookstore.js';
export interface FirestoreBookstore extends Bookstore {
  proxyUrl: string;
}
