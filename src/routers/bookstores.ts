import { Router } from 'express';
import { getBookstores } from '../firestore';

const bookstoresRouter = Router();

bookstoresRouter.get('/', (req, res, next) => {
  getBookstores()
    .then(bookstores => {
      return res.status(200).send(bookstores);
    })
    .catch(error => {
      console.time('Error time: ');
      console.error(error);

      return res.status(503).send({
        message: 'Something is wrong...',
      });
    });
});

bookstoresRouter.get('/:id', (req, res, next) => {
  const id: string = req.params.id;
  getBookstores(id)
    .then(bookstores => {
      if (bookstores.length == 0) {
        return res.status(400).send({
          message: `Bookstore ${id} is invalid.`,
        });
      }
      return res.status(200).send(bookstores);
    })
    .catch(error => {
      console.time('Error time: ');
      console.error(error);

      return res.status(503).send({
        message: 'Something is wrong...',
      });
    });
});

export { bookstoresRouter };
