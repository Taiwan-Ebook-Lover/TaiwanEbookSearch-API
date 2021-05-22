# TaiwanEbookSearch API

![](https://media.giphy.com/media/ggj6JI9uKxTaBB81Yo/giphy.gif)

## Prerequisite

1. Install [Git latest version](https://git-scm.com) and [Node.js latest LTS version](https://nodejs.org)
2. Get codebase
   ```bash
   $ git clone git@github.com:Taiwan-Ebook-Lover/TaiwanEbookSearch-API.git
   ```
3. Install dependencies
   ```bash
   $ cd TaiwanEbookSearch-API
   $ npm install
   ```

## Environment variables

Copy `.env.example` to `.env` to customize those environment variables.

### The `.env` structure

- `PORT` => local serve port number.
- `TOKEN` => Telegram bot token.
- `GROUPID` => Telegram group id.
- `DBURL` => Firebase project URL.
- `FIREBASE_SERVICE_ACCOUNT_BASE64` => BASE64 string of firebase service account file. (Tool script: `$ npm run convert-firebase-config -- -in serviceAccount.json`)
- `READMOO_AP_ID` => Readmoo affiliate program id.

## Build & Serve

proxy to local server:

```bash
npm run build
npm start
```
