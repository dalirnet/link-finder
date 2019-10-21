const open = require('open');
const server = require('server');
const { get, post } = require('server/router');
const { status, render, json } = require('server/reply');
const figlet = require('figlet');
const request = require('request-promise');
const _ = require('lodash');
const extractDomain = require('extract-domain');
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

const link = {
  type(link, baseDomain) {
    // [internal,external,social,void]
    if (link.indexOf('http://') < 0 && link.indexOf('https://') < 0) {
      return 'void';
    } else {
      let domain = extractDomain(link);
      if (_.indexOf(['facebook.com', 'instagram.com', 'google.com', 'aparat.com', 'twitter.com', 't.me', 'telegram.me'], domain) > -1) {
        return 'social';
      } else if (domain != baseDomain) {
        return 'external';
      }
    }

    return 'internal';
  },
  anchor(html) {
    let anchor = "";
    _.forEach(html.getElementsByTagName('img'), (img) => {
      if (img.getAttribute("alt")) {
        anchor = img.getAttribute("alt");
        return false;
      }
    });
    if (anchor == "") {
      if (html.getAttribute("title")) {
        anchor = html.getAttribute("title");
      } else {
        anchor = html.textContent;
      }
    }
    return anchor.replace(/\s\s+/g, ' ').trim();
  },
  rel(rel) {
    if (!rel) {
      return 'follow';
    }
    return rel;
  }
};

figlet('Link', (err, data) => {
  if (!err && !args.debug) {
    console.log(data);
  }
  server({
    port: args.port,
    views: 'template',
    public: 'public',
    engine: 'hbs',
    favicon: 'public/icon.png'
  }, [
    get('/', ctx => {
      return render('form.hbs', { name: 'amir' });
    }),
    get('/fetch', ctx => {
      let data = {
        url: ctx.query.url,
        title: ctx.query.url,
        link: {
          internal: [],
          external: [],
          social: [],
          void: []
        },
        domain: [],
        repeat: {
          link: [],
          anchor: []
        }
      };
      return request.get(encodeURI(ctx.query.url)).then((html) => {
        const baseDomain = extractDomain(ctx.query.url);
        const { document } = (new JSDOM(html)).window;
        // parse page
        data.title = document.getElementsByTagName('title')[0].innerHTML;
        _.forEach(document.getElementsByTagName('a'), (item) => {
          let href = decodeURI(item.getAttribute('href') ? item.getAttribute('href') : "");
          if (href) {
            let domain = (extractDomain(href) ? extractDomain(href) : baseDomain);
            let type = link.type(href, baseDomain);
            let anchor = link.anchor(item);
            let rel = link.rel(item.getAttribute('rel'));
            //
            data.link[type].push({ href, domain, anchor, rel });
            if (type == "external") {
              data.domain.push(domain);
            }
            if (type == "internal") {
              data.repeat.link.push(href);
              data.repeat.anchor.push(anchor);
            }
          }
        });
        data.domain = _.countBy(data.domain);
        data.repeat.link = _.fromPairs(_.reverse(_.sortBy(_.toPairs(_.pickBy(_.countBy(data.repeat.link), (v, i) => { return v > 2 })), 1)));
        data.repeat.anchor = _.fromPairs(_.reverse(_.sortBy(_.toPairs(_.pickBy(_.countBy(data.repeat.anchor), (v, i) => { return v > 1 })), 1)));
        data.count = {
          link: {
            internal: data.link.internal.length,
            external: data.link.external.length,
            social: data.link.social.length,
            void: data.link.void.length
          },
          domain: _.size(data.domain),
          repeat: {
            link: _.size(data.repeat.link),
            anchor: _.size(data.repeat.anchor)
          }
        };
        return render('report.hbs', data);
      }).catch((err) => {
        console.error(err.message);
        return render('form.hbs', { error: "خطا!" });
      });
    })
  ]);
  if (!args.debug) {
    open('http://localhost:' + args.port);
  }
});