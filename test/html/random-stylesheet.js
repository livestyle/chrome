/**
 * A small Node.js web-server for serving static files.
 * Outputs HTML with random stylesteet URL
 */
var fs = require('fs');
var path = require('path');
var http = require('http');
var connect = require('connect');
var serveStatic = require('serve-static');

var app = connect();
app.use(function(req, res, next) {
	req.url = req.url.replace(/^\/\-\/\w+\//, '/');
	if (!/\.html?$/.test(req.url)) {
		return next();
	}

	var contents = fs.readFileSync(path.join(__dirname, req.url), 'utf8');
	res.end(contents.replace(/("|')([\w\/]+.css)\1/g, function(str, quote, url) {
		return quote + path.join('/-/' + (Math.random() * 1000 | 0), url) + quote;
	}));
});
app.use(serveStatic('./'));

console.log('Starting local web-server on http://localhost:3000');
http.createServer(app).listen(3000);