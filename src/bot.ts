import TelegramBot from 'node-telegram-bot-api';

let bot: TelegramBot;
let groupId: string;

export const botInit = (token: string, group: string) => {
  return new Promise<void>((resolve, reject) => {
    if (bot) {
      return reject('bot is already inited.');
    }

    bot = new TelegramBot(token, {
      polling: false,
      request: {
        url: 'https://api.telegram.org',
        agentOptions: {
          keepAlive: true,
          family: 4,
        },
      },
    });
    groupId = group;

    resolve();
  }).catch((error) => {
    if (error) {
      console.error(error);
    }
  });
};

export const sendMessage = (message: string) => {
  return bot
    .sendMessage(groupId, message, { parse_mode: 'Markdown' })
    .catch((error) => console.error(error));
};
