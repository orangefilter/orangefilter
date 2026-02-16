const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/test_page.html' : req.url;
  let filePath = path.join(__dirname, '..', 'tests', urlPath);

  // console.log(`Serving ${req.url} from ${filePath}`);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    let contentType = 'text/html';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg'))
      contentType = 'image/jpeg';
    if (filePath.endsWith('.webp')) contentType = 'image/webp';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

const PORT = 8080;
const HOST = '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});

// Keep it running for the test
process.on('SIGTERM', () => {
  server.close();
});
