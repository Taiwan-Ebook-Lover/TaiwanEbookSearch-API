import express, { RequestHandler } from 'express';
import cors from 'cors';
import compression from 'compression';

import 'dotenv/config';

import { botInit } from './bot.js';
import { connect } from './firestore.js';
import { searchRouter } from './routers/search.js';
import { ServiceAccount } from 'firebase-admin';
import serviceAccount from './auth/serviceAccount.json' assert { type: 'json' };

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
app.use(express.json() as RequestHandler);

// for parsing application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }) as RequestHandler);

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

app.use('/search', searchRouter);

/**
 * Error Handler
 */

app.get('*', (req, res) => {
  return res.status(405).send({
    message: 'Method Not Allowed!',
  });
});

init();
