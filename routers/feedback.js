const express = require('express');
const feedbackRouter = express.Router();
const db = require('../db');
const bot = require('../bot');

const feedbackTypeList = ['error', 'suggestion', 'wish', 'others'];

feedbackRouter.post('/', (req, res, next) => {

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
  const feedback = {feedbackDateTime, type, name, email, body};

  if (db) {
    // insert feedback
    db.insertFeedback(feedback);
  }

  bot.sendMessage(`${JSON.stringify(feedback, null, '  ')}`);

  return res.status(200).send({
    message: 'Ok.'
  });

});

module.exports = feedbackRouter;
