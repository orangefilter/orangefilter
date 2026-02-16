const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runTest() {
  const EXTENSION_PATH = path.resolve(__dirname, '../dist');
  const testPagePath = path.resolve(__dirname, '../tests/test_page.html');
  const testPageContent = fs.readFileSync(testPagePath, 'utf8');

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
    console.log('Waiting for extension...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const page = await browser.newPage();

    // Enable request interception to serve local content for mytestsite.com
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('mytestsite.com/test')) {
        request.respond({
          status: 200,
          contentType: 'text/html',
          body: testPageContent,
        });
      } else {
        request.continue();
      }
    });

    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

    const testUrl = 'http://mytestsite.com/test';
    console.log(`Navigating to ${testUrl}`);
    await page.goto(testUrl, { waitUntil: 'networkidle0' });

    console.log('Waiting for content script...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check text-match
    const result = await page.evaluate(() => {
      const el = document.getElementById('text-match');
      if (!el) return { error: 'Element #text-match not found' };
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        hiddenAttr: el.getAttribute('data-orange-filter-hidden'),
        html: el.outerHTML.substring(0, 100),
      };
    });

    console.log('Result:', result);

    if (result.display === 'none' || result.hiddenAttr === 'true') {
      console.log('✅ SUCCESS: Content filtered!');
    } else {
      console.error('❌ FAILURE: Content NOT filtered!');
    }
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
  }
}

runTest();
