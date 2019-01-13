const MongoClient = require('mongodb').MongoClient;

const state = {
  db: null,
};

exports.connect = function(url, done) {
  if (state.db) {
    return done();
  }

  MongoClient.connect(url, { useNewUrlParser: true }, function(error, db) {
    if (error)
      return done(error)
    state.db = db;
    done();
  })
}

exports.get = function() {
  return state.db
}

exports.insertOne = function(collectionName, data) {
  return state.db.db().collection(collectionName).insertOne(data)
}

exports.close = function(done) {
  if (state.db) {
    state.db.close(function(error, result) {
      state.db = null
      state.mode = null
      done(error)
    })
  }
}
