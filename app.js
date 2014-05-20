var express = require('express');
var cloudflare = require('cloudflare');

var fs = require('fs');
var app = express();

var config;
if (process.env.NODE_ENV != 'production') {
	config = require('./config');
} else {
	config = { cloudflare: {
		email: process.env.CLOUDFLARE_EMAIL,
		token: process.env.CLOUDFLARE_TOKEN,
	} };
}

var cf = cloudflare.createClient(config.cloudflare);

var list = '';
var index = '';

app.get('/', function(req, res) {
	if (!index || process.env.NODE_ENV == 'development')
		index = fs.readFileSync('public/index.html').toString('utf8');

	res.send(index.replace('{{list}}', list.join('\n')).replace('{{files}}', 0).replace('{{dirs}}', list.length + 2));
});

app.use(express.static('public'));

(function get(fb) {
	cf.listDomainRecords('9k1.us', function (err, records) {
		if (err)
			return console.error(err);

		list = records
			.filter(function(record) {
				return ['A', 'AAAA', 'CNAME'].indexOf(record.type) >= 0 && /\.app$/.test(record.display_name);
			})

			.sort(function(a, b) {
				if (a.name > b.name)
					return 1;

				if (a.name < b.name)
					return -1;

				return 0;
			})

			.filter(function(value, i, array) {
				return i == 0 || array[i - 1].name != value.name;
			})

			.map(function(record) {
				return [
					'31.01.2101 23:59',
					'    &lt;DIR&gt;          ',
					record.name,
				].join('');
			});

	});

	setTimeout(get, 60 * 60 * 1000);
})();

app.listen(process.env.PORT || 9001);
