import { Book } from './book.js';
import { Bookstore } from './bookstore.js';

export interface Result {
  bookstore: Bookstore;
  isOkay: boolean;
  status: string;
  processTime: number;
  quantity: number;
  books: Book[] | [];
  error?: string;
}
