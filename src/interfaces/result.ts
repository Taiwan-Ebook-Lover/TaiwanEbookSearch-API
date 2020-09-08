import { Book } from './book';
import { Bookstore } from './bookstore';

export interface Result {
  bookstore: Bookstore;
  isOkay: boolean;
  status: string;
  processTime: number;
  quantity: number;
  books: Book[] | [];
  error?: string;
}
