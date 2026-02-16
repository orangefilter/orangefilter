const puppeteer = require('puppeteer');
const path = require('path');
const http = require('http');
const fs = require('fs');

async function runTest() {
  const EXTENSION_PATH = path.resolve(__dirname, '../dist');
  const testsDir = path.resolve(__dirname, '../tests');

  // 1. Start Server
  const server = http.createServer((req, res) => {
    let urlPath = req.url === '/' ? '/test_page.html' : req.url;
    let filePath = path.join(testsDir, urlPath);

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
  });

  const PORT = 8081;
  const HOST = '127.0.0.1';
  server.listen(PORT, HOST);
  console.log(`Server running at http://${HOST}:${PORT}/`);

  // 2. Launch Browser
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  try {
    console.log('Waiting for extension to load...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const targets = await browser.targets();
    console.log(
      'All Targets:',
      targets.map((t) => `${t.type()} - ${t.url()}`)
    );

    const workerTarget = targets.find((t) => t.type() === 'service_worker');
    if (workerTarget) {
      console.log('Hooking worker:', workerTarget.url());
      const worker = await workerTarget.worker();
      worker.on('console', (msg) => console.log('BACKGROUND LOG:', msg.text()));

      // Try to ping the worker
      try {
        const res = await worker.evaluate(() => {
          console.log('Worker eval test');
          return typeof chrome !== 'undefined';
        });
        console.log('Worker eval result (chrome exists):', res);
      } catch (e) {
        console.error('Worker eval failed:', e.message);
      }
    }

    const page = await browser.newPage();
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

    const testPageUrl = `http://${HOST}:${PORT}/test_page.html`;
    console.log(`Navigating to ${testPageUrl}`);
    await page.goto(testPageUrl);

    console.log('Waiting for content script...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check text-match
    const textMatchHidden = await page.$eval('#text-match', (el) => {
      return (
        window.getComputedStyle(el).display === 'none' ||
        el.hasAttribute('data-orange-filter-hidden')
      );
    });
    console.log('Text Match Hidden:', textMatchHidden);

    if (textMatchHidden) {
      console.log('✅ SUCCESS: Content filtered!');
    } else {
      console.error('❌ FAILURE: Content NOT filtered!');
    }
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
    server.close();
  }
}

runTest();
