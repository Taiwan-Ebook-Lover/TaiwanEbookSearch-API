const TelegramBot = require('node-telegram-bot-api');

const state = {
  bot: null,
  groupID: '',
};

const init = (token, groupID) => {
  return new Promise((resolve, reject) => {
    if (state.bot) {
      return reject('bot is already inited.');
    } else {
      state.bot = new TelegramBot(token, { polling: false });
      state.groupID = groupID;

      resolve();
    }
  }).catch(error => {
    if (error) {
      console.error(error);
    }
  });
};

const sendMessage = message => {
  return state.bot.sendMessage(state.groupID, message).catch(error => console.error(error));
};

module.exports = {
  init,
  sendMessage,
};
