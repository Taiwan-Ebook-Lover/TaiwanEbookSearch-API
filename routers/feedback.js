const express = require('express');
const feedbackRouter = express.Router();
const db = require('../db');
const bot = require('../bot');
const uaParser = require('ua-parser-js');
const rp = require('request-promise-native');

const feedbackTypeList = ['error', 'suggestion', 'wish', 'others'];
const trello = JSON.parse(process.env.TRELLO);

feedbackRouter.post('/', (req, res, next) => {

  // parse user agent
  const ua = uaParser(req.headers['user-agent']);
  const feedbackDateTime = new Date().toISOString();
  const type = req.body.type ? req.body.type : 'others';
  const name = req.body.name ? req.body.name : '';
  const email = req.body.email ? req.body.email : '';
  const body = req.body.body;

  // 沒有 body 就滾回去
  if (!body) {
    return res.status(400).send({
      message: 'body is required.'
    });
  }

  // type 錯誤也都請回
  if (!feedbackTypeList.includes(type)) {
    return res.status(400).send({
      message: 'error type.'
    });
  }

  // 整理一下 feedback
  const feedback = {
    feedbackDateTime,
    type,
    name,
    email,
    body,
    ...ua};

  if (db) {
    // insert feedback
    db.insertFeedback(feedback);
  }

  const feedbackString = `${JSON.stringify(feedback, null, '  ')}`;

  console.log(trello);

  // send to trello

  const options = {
    method: 'post',
    uri: `https://api.trello.com/1/cards`,
    body: {
      desc: feedbackString,
      name: `${feedback.type} - ${feedback._id} - ${feedback.feedbackDateTime}`,
      idLabels: trello.labels[feedback.type],
      idList: trello.feedbackList,
      key: trello.key,
      token: trello.token,
      pos: "top"
    },
    json: true,
    resolveWithFullResponse: true,
    simple: false,
    gzip: true,
    timeout: 10000,
  };

  rp(options).then(() => {
    bot.sendMessage(feedbackString);
    return res.status(200).send({
      message: 'Ok.'
    });
  }).catch((error) => {
    console.log(error);
    bot.sendMessage(JSON.stringify(error));
    return res.status(503).send({
      message: 'Something is wrong...'
    });
  });

});

module.exports = feedbackRouter;
