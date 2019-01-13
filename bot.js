const TelegramBot = require('node-telegram-bot-api');

const state = {
  bot: null,
  groupID: '',
}

exports.init = function(token, groupID) {
  if (state.bot) {
    return;
  }
  state.bot = new TelegramBot(token, {polling: false});
  state.groupID = groupID;
};

exports.sendMessage = function(message) {
  state.bot.sendMessage(state.groupID, message);
}
