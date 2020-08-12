import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import compression from 'compression';

import './env';
import { botInit } from './bot';
import { connect } from './firestore';
import { searchesRouter } from './routers/searches';
import { bookstoresRouter } from './routers/bookstores';
import { ServiceAccount } from 'firebase-admin';
import * as serviceAccount from './auth/serviceAccount.json';

const app: express.Application = express();

const init = () => {
  // Telegram bot is coming
  botInit(process.env.TOKEN as string, process.env.GROUPID as string);
  // Database is coming too
  connect(process.env.DBURL as string, serviceAccount as ServiceAccount);

  /**
   * Build db, Server
   */

  app.listen(process.env.PORT, () => {
    console.log(`listening on http://localhost:${process.env.PORT}`);
  });
};

// compress all responses
app.use(compression());

// for parsing application/json
app.use(bodyParser.json());

// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// for cors
app.use(
  cors({
    methods: ['GET', 'POST', 'PATCH', 'OPTION', 'DELETE'],
    credentials: true,
    origin: true,
  })
);

/**
 * Route
 */

app.use('/searches', searchRouter);

app.use('/bookstores', bookstoresRouter);

/**
 * Error Handler
 */

app.get('*', (req, res) => {
  return res.status(405).send({
    message: 'Method Not Allowed!',
  });
});

init();
