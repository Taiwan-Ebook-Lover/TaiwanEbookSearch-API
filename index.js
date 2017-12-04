require('dotenv').config();
const app = require('express')();
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const rp = require('request-promise-native');
const cheerio = require('cheerio');
const http = require('http').Server(app);

const readmoo = require('./readmoo');
const booksCompany = require('./booksCompany');
const kobo = require('./kobo');
const taaze = require('./taaze');
const bookWalker = require('./bookWalker');

// compress all responses
app.use(compression());

// for parsing application/json
app.use(bodyParser.json());

// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// for cors
app.use(cors({
  methods: ['GET', 'POST', 'PATCH', 'OPTION', 'DELETE'],
  credentials: true,
  origin: true
}));

app.get('/search', (req, res, next) => {
  const keywords = req.query.q;

  // 關鍵字是必須的
  if (!keywords) {
    return res.status(400).send({
      message: 'q is required.'
    });
  }

  // 一次查四家！
  Promise.all([
    booksCompany.searchBooks(keywords),
    readmoo.searchBooks(keywords),
    kobo.searchBooks(keywords),
    taaze.searchBooks(keywords),
    bookWalker.searchBooks(keywords),
  ]).then(data => {

    const result = {
      booksCompany: data[0],
      readmoo: data[1],
      kobo: data[2],
      taaze: data[3],
      bookWalker: data[4],
    };

    return res.send(result);
  }).catch(error => {
    console.log(error);

    return res.status(503).send({
      message: 'Something is wrong...'
    });
  });

});

app.get('*', function (req, res) {
  return res.status(405).send({
    message: 'Method Not Allowed!'
  });
});

http.listen(process.env.PORT, () => {
  console.log(`listening on http://localhost:${process.env.PORT}`);
});
