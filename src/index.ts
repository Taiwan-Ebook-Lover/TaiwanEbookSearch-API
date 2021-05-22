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

const app: express.Application = express();

const init = () => {
  // Telegram bot is coming
  botInit(process.env.TOKEN as string, process.env.GROUPID as string);

  // Database is coming too
  const firebaseUrl: string = process.env.DBURL ?? '';
  const serviceAccount: ServiceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 as string, 'base64').toString(),
  );

  connect(firebaseUrl, serviceAccount);

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
  }),
);

/**
 * Route
 */

app.use('/searches', searchesRouter);

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
