const open = require('open');
const server = require('server');
const { get, post } = require('server/router');
const { status, render, json } = require('server/reply');
const figlet = require('figlet');
const request = require('request-promise');
const _ = require('lodash');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const args = require('minimist')(process.argv.slice(2), {
  alias: {
    d: 'debug',
    p: 'port'
  },
  default: {
    debug: 0,
    port: 8085
  }
});

figlet('Link', (err, data) => {
  if (!err && !args.debug) {
    console.log(data);
  }
  server({
    port: args.port,
    views: 'template',
    public: 'public',
    engine: 'html',
    favicon: 'public/icon.png'
  }, [
    get('/', ctx => {
      return render('index.html');
    }),
    post('/', ctx => request.get(ctx.data).then((html) => {
      const { document } = (new JSDOM(html)).window;

      return json(words);
    }).catch((err) => {
      console.error(err.message);
      return status(400);
    }))
  ]);
  if (typeof (process.argv[0])) {

  }
  if (!args.debug) {
    open('http://localhost:' + args.port);
  }
});