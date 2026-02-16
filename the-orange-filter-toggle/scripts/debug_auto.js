const puppeteer = require('puppeteer');
const path = require('path');
const http = require('http');
const fs = require('fs');

async function run() {
  // Start Server
  const server = http.createServer((req, res) => {
    let urlPath = req.url === '/' ? '/test_page.html' : req.url;
    let filePath = path.join(__dirname, '..', 'tests', urlPath);
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
  });
  server.listen(8080, 'localhost');

  const EXTENSION_PATH = path.resolve(__dirname, '../dist');
  console.log('🚀 Launching Chrome with extension...');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const hookTarget = async (target) => {
    console.log(`Target: ${target.type()} - ${target.url()}`);
    try {
      if (target.type() === 'service_worker') {
        const worker = await target.worker();
        if (worker)
          worker.on('console', (msg) =>
            console.log(`[BACKGROUND][${msg.type()}]`, msg.text())
          );
      } else {
        const page = await target.page();
        if (page) {
          page.on('console', (msg) =>
            console.log(`[${target.type()}][${msg.type()}]`, msg.text())
          );
          page.on('pageerror', (err) =>
            console.error(`[${target.type()}][ERROR]`, err.message)
          );
        }
      }
    } catch (e) {
      // console.log(`Failed to hook ${target.type()}: ${e.message}`);
    }
  };

  browser.on('targetcreated', hookTarget);
  for (const target of await browser.targets()) {
    hookTarget(target);
  }

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('[PAGE]', msg.text()));

  console.log('Navigating to http://localhost:8080/test_page.html');
  await page.goto('http://localhost:8080/test_page.html');

  await new Promise((resolve) => setTimeout(resolve, 10000));
  await browser.close();
  server.close();
  process.exit(0);
}

run();
