import { Bookstore } from './bookstore';
export interface FirestoreBookstore extends Bookstore {
  proxyUrl: string;
}
