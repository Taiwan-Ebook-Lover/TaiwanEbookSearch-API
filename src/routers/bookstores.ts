import { Router } from 'express';
import { getBookstores } from '../firestore.js';

const bookstoresRouter = Router();

bookstoresRouter.get('/', (req, res, next) => {
  getBookstores()
    .then((bookstores) => {
      return res.status(200).send(bookstores.map(({ proxyUrl, ...bookstore }) => bookstore));
    })
    .catch((error) => {
      console.time('Error time: ');
      console.error(error);

      return res.status(503).send({
        message: 'Something is wrong...',
      });
    });
});

bookstoresRouter.get('/:id', (req, res, next) => {
  const bookstoreId: string = req.params.id;
  getBookstores(bookstoreId)
    .then((bookstores) => {
      if (bookstores.length == 0) {
        return res.status(400).send({
          message: `Bookstore ${bookstoreId} is invalid.`,
        });
      }
      const { proxyUrl, ...bookstore } = bookstores[0];
      return res.status(200).send(bookstore);
    })
    .catch((error) => {
      console.time('Error time: ');
      console.error(error);

      return res.status(503).send({
        message: 'Something is wrong...',
      });
    });
});

export { bookstoresRouter };
