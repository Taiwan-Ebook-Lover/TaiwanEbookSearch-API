import { MongoClient } from 'mongodb';
import { AnyObject } from './interfaces/general';

export let db: MongoClient;

export const connect = (url: string) => {
  return new Promise<MongoClient>((resolve, reject) => {
    // check db connected status
    if (db) {
      reject('DB is already connected.');
    } else {
      resolve(MongoClient.connect(url, { useUnifiedTopology: true, useNewUrlParser: true }));
    }
  })
    .then((mongoClient: MongoClient) => {
      // update db client
      db = mongoClient;
    })
    .catch(error => {
      if (error) {
        console.error(error);
      }
    });
};

export const get = () => {
  return db;
};

const insertOne = (collectionName: string, data: any) => {
  return db
    .db()
    .collection(collectionName)
    .insertOne(data)
    .catch(error => {
      console.error(error.stack);
    });
};

export const close = () => {
  return new Promise((resolve, reject) => {
    // check db connected status
    if (!db) {
      reject('DB is not connected.');
    } else {
      resolve(db.close());
    }
  })
    .then(result => {
      console.log(result);
    })
    .catch(error => {
      if (error) {
        console.error(error);
      }
    });
};

export const insertRecord = (record: AnyObject<any> = {}) => {
  return insertOne('records', record);
};
