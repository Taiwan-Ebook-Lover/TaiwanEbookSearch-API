const MongoClient = require('mongodb').MongoClient;

const state = {
  db: null,
};

const connect = url => {
  return new Promise((resolve, reject) => {
    // check db connected status
    if (state.db) {
      reject('DB is already connected.');
    } else {
      resolve(MongoClient.connect(url, { useNewUrlParser: true }));
    }
  })
    .then(db => {
      // update db client
      state.db = db;
    })
    .catch(error => {
      if (error) {
        console.error(error);
      }
    });
};

const get = () => {
  return state.db;
};

const insertOne = (collectionName, data) => {
  return state.db
    .db()
    .collection(collectionName)
    .insertOne(data)
    .catch(error => {
      console.error(error.stack);
    });
};

const close = cb => {
  return new Promise((resolve, reject) => {
    // check db connected status
    if (!state.db) {
      reject('DB is not connected.');
    } else {
      resolve(state.db.close());
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

const insertRecord = (record = {}) => {
  return insertOne('records', record);
};

module.exports = {
  connect,
  get,
  close,
  insertRecord,
};
