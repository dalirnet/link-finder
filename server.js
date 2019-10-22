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
const ignoreWords = require('./keyword.ignore.json');

const socialLink = [
  'facebook.com',
  'instagram.com',
  'google.com',
  'youtube.com',
  'aparat.com',
  'twitter.com',
  't.me',
  'telegram.me',
  'linkedin.com',
  'github.com'
];
const link = {
  type(link, baseDomain) {
    // [internal,external,social,void]
    if (link.indexOf('http://') < 0 && link.indexOf('https://') < 0) {
      return 'void';
    } else {
      let domain = extractDomain(link);
      if (_.indexOf(socialLink, domain) !== -1) {
        return 'social';
      } else if (domain != baseDomain) {
        return 'external';
      }
    }
    if (link.match(/(\.jpg|\.png|\.gif|\.webp|\.svg)/g)) {
      return 'image';
    }

    return 'internal';
  },
  anchor(html) {
    let anchor = '';
    _.forEach(html.getElementsByTagName('img'), (img) => {
      if (img.getAttribute('alt')) {
        anchor = img.getAttribute('alt');
        return false;
      }
    });
    if (anchor == '') {
      if (html.getAttribute('alt')) {
        anchor = html.getAttribute('alt');
      }
      else if (html.getAttribute('title')) {
        anchor = html.getAttribute('title');
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
          void: [],
          image: []
        },
        domain: [],
        words: [],
        repeat: {
          link: [],
          anchor: []
        }
      };
      var options = {
        uri: encodeURI(ctx.query.url),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)'
        }
      };
      return request(options).then((html) => {
        const baseDomain = extractDomain(ctx.query.url);
        let baseUrl = ctx.query.url;
        let matchBaseUrl = baseUrl.match(/((http|https):\/\/)[^\/]+\//ig);
        if (matchBaseUrl) {
          baseUrl = matchBaseUrl[0];
        }
        baseUrl = baseUrl.replace(/^\/|\/$/g, '');
        const { document } = (new JSDOM(html)).window;
        // parse page
        data.title = document.getElementsByTagName('title')[0].innerHTML;
        let aTag = document.getElementsByTagName('a');
        _.forEach(aTag, (item) => {
          let href = decodeURI(item.getAttribute('href') ? item.getAttribute('href') : '');
          if (href.charAt(0) == '/') {
            href = baseUrl + href;
          }
          href = href.trim();
          if (href) {
            let domain = (extractDomain(href) ? extractDomain(href) : baseDomain);
            let type = link.type(href, baseDomain);
            let anchor = link.anchor(item);
            let rel = link.rel(item.getAttribute('rel'));
            //
            data.link[type].push({ href, domain, anchor, rel });
            if (type == 'external') {
              data.domain.push(domain);
            }
            if (type == 'internal' || type == 'image') {
              data.repeat.link.push(href);
              data.repeat.anchor.push(anchor);
            }
          }
        });
        let imgTag = document.getElementsByTagName('img');
        _.forEach(imgTag, (item) => {
          let src = decodeURI(item.getAttribute('data-src') ? item.getAttribute('data-src') : (item.getAttribute('src') ? item.getAttribute('src') : ''));
          if (src.charAt(0) == '/') {
            src = baseUrl + src;
          }
          src = src.trim();
          if (src) {
            data.link['image'].push({ href: src, anchor: link.anchor(item) });
          }
        });
        let content = document.getElementsByTagName('body')[0].innerHTML;
        content = content.replace(/<script([\S\s]*?)>([\S\s]*?)<\/script>/gi, '').replace(/<style([\S\s]*?)>([\S\s]*?)<\/style>/gi, '').replace(/<!--(.*?)-->/g, '');
        content = content.replace(/[^abcdefghijklmnopqrstuvwxyzضصثقفغعهخحجچپشسیبلاآتنمکگظطزرذدئو\-\_\@\#\<\>]/gi, ' ');
        content = content.replace(/<.*?>/g, '====').replace(/\s\s+/g, ' ').replace(/=\s=/g, '==').replace(/==+/g, ' <> ');
        let allWords = [];
        _.forEach(content.split(' '), (item) => {
          if (item.length > 1 && _.indexOf(ignoreWords, item) === -1) {
            allWords.push(item);
          }
        });
        _.forEach(allWords, (word, key) => {
          if (word != '<>') {
            data.words.push(word);
            if (typeof (allWords[key + 1]) !== 'undefined') {
              if (allWords[key + 1] != '<>') {
                data.words.push(word + ' ' + allWords[key + 1]);
                if (typeof (allWords[key + 2]) !== 'undefined') {
                  if (allWords[key + 2] != '<>') {
                    data.words.push(word + ' ' + allWords[key + 1] + ' ' + allWords[key + 2]);
                  }
                }
              }
            }
          }
        });
        data.domain = _.countBy(data.domain);
        data.repeat.link = _.fromPairs(_.reverse(_.sortBy(_.toPairs(_.pickBy(_.countBy(data.repeat.link), (v, i) => { return v > 2 })), 1)));
        data.repeat.anchor = _.fromPairs(_.reverse(_.sortBy(_.toPairs(_.pickBy(_.countBy(data.repeat.anchor), (v, i) => { return v > 2 })), 1)));
        data.words = _.fromPairs(_.reverse(_.sortBy(_.toPairs(_.pickBy(_.countBy(data.words), (v, i) => { return v > 2 })), 1)));
        data.count = {
          link: {
            internal: data.link.internal.length,
            external: data.link.external.length,
            social: data.link.social.length,
            void: data.link.void.length,
            image: data.link.image.length
          },
          words: _.size(data.words),
          density: 0,
          domain: _.size(data.domain),
          repeat: {
            link: _.size(data.repeat.link),
            anchor: _.size(data.repeat.anchor)
          }
        };
        data.count.density = Math.floor((data.count.words * 100) / allWords.length);
        return render('report.hbs', data);
      }).catch((err) => {
        console.error(err.message);
        return render('form.hbs', { error: 'خطا!' });
      });
    })
  ]);
  if (!args.debug) {
    open('http://localhost:' + args.port);
  }
});