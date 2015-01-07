'use strict';

var express = require('express');
var cloudflare = require('cloudflare');
var request = require('request');
var async = require('async');
var moment = require('moment');

var fs = require('fs');
var app = express();

var cf = cloudflare.createClient({
  email: process.env.CLOUDFLARE_EMAIL,
  token: process.env.CLOUDFLARE_TOKEN,
});

var list = [];
var index = '';
var bytes = 0;

function format(num) {
  return (''+num)
    .replace(/(\d{0,3}?)(\d{0,3}?)(\d{0,3}?)(\d{0,3}?)$/g, '$1 $2 $3 $4')
    .trim();
}

app.get('/', function(req, res) {
  if (!index || process.env.NODE_ENV == 'development')
    index = fs.readFileSync('public/index.html').toString('utf8');

  var files = list.length - 2;
  var remaining = format(704161611776 - bytes);
  var byte = format(bytes);

  res.send(
    index
      .replace('{{list}}', list.join('\n'))
      .replace('{{bytes}}', new Array(14 - (''+byte).length).join(' ') + byte)
      .replace('{{files}}', new Array(4 - (''+files).length).join(' ') + files)
      .replace('{{remaining}}', remaining)
  );
});

app.use(express.static('public'));

(function get() {
  cf.listDomainRecords('9k1.us', function (err, records) {
    if (err)
      return console.error(err);

    records = records
      .filter(function(record) {
        return ['A', 'AAAA', 'CNAME'].indexOf(record.type) >= 0 &&
          /^[a-z0-9_-]+\.app$/.test(record.display_name);
      })

      .concat([
        { name: 'app.9k1.us', display_name: '.' },
        { name: '9k1.us', display_name: '..' },
      ])

      .sort(function(a, b) {
        if (a.display_name > b.display_name)
          return 1;

        if (a.display_name < b.display_name)
          return -1;

        return 0;
      });


    async.parallel(
      records.map(function(record) {
        return function(result) {
          request.get('http://' + record.name, function(err, response) {
            result(err, [response, record]);
          });
        };
      }),

      function(err, results) {
        bytes = 0;

        list = results
          .map(function(result) {
            var response = result[0];
            var record = result[1];

            var m = moment(response.headers['last-modified']);

            bytes += response.body.length;

            return [
              m.format('DD.MM.YYYY HH:mm'),
              '    ',
              /\.app$/.test(record.display_name) ? '     ' : '&lt;DIR&gt;',
              '          ',
              '<a href="http://', record.name, '">',
              record.display_name.replace(/\.app$/, ''),
              '</a>',
            ].join('');
          });
      }
    );
  });

  setTimeout(get, 24 * 60 * 60 * 1000);
})();

app.listen(process.env.PORT || 9001);
