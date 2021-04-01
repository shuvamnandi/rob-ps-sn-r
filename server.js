"use strict";

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080; // To support Heroku deployment, Env variable set by Heroku

const server = http.createServer((request, response) => {
  if (request.url.startsWith('/api')) {
    apiHandler(request, response);
  } else {
    fileHandler(request, response);
  }
}).listen(PORT);

function apiHandler(request, response) {
  console.log("Got API request");
  let dataBuf = new Buffer(0);
  request.on('data', (chunk) => {
    dataBuf = Buffer.concat([dataBuf, chunk]);
  });
  request.on('end', () => {

    const query = url.parse(request.url, true).query;

    const json = {
      'status': 'OK',
      'headers': request.headers,
      'httpVersion': request.httpVersion,
      'method': request.method,
      'input-count': dataBuf.length,
      'input-md5': crypto.createHash('md5').update(dataBuf).digest("hex")
    };

    response.writeHead(200, { 'Content-Type': "application/json", "server": "javapolyTest000" });
    response.end(JSON.stringify(json), 'utf-8');
  });
}

function fileHandler(request, response) {
  let filePath = '.' + url.parse(request.url).pathname;
  if (filePath === './') {
    filePath = './index.html';
  }
  console.log("filePath: ["+ filePath+ "]");

  const extname = path.extname(filePath);
  let contentType = 'application/octet-stream';
  switch (extname) {
    case '.html':
      contentType = 'text/html';
      break;
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
      contentType = 'image/jpg';
      break;
    case '.wav':
      contentType = 'audio/wav';
      break;
  }

  fs.readFile(filePath, function(error, content) {
    if (error) {
      if(error.code == 'ENOENT') {
        fs.readFile('./404.html', function(error, content) {
          response.writeHead(404, { 'Content-Type': contentType });
          response.end(content, 'utf-8');
        });
      } else {
        console.log(error);
        response.writeHead(500);
        response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
        response.end();
      }
    } else {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
    }
  });

}

if (process.env.PORT) {
  console.log('Server running at heroku on port ' + PORT);
} else {
  console.log('Local server running at http://127.0.0.1:' + PORT + '/');
}

