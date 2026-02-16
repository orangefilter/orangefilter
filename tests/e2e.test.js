const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

describe('Orange Filter E2E', () => {
  let browser;
  let page;
  const EXTENSION_PATH = path.resolve(__dirname, '../dist');
  const testPagePath = path.resolve(__dirname, 'test_page.html');
  const testPageContent = fs.readFileSync(testPagePath, 'utf8');

  beforeAll(async () => {
    try {
      browser = await puppeteer.launch({
        headless: false,
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--enable-unsafe-webgpu',
        ],
      });
      console.log('Browser launched');
    } catch (err) {
      console.error('Failed to launch browser:', err);
      throw err;
    }
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  test('Filtering should work correctly including AI', async () => {
    page = await browser.newPage();
    page.on('console', (msg) => console.log('[PAGE]', msg.text()));

    // 1. Setup Interception
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('mytestsite.com/test')) {
        request.respond({
          status: 200,
          contentType: 'text/html',
          body: testPageContent,
        });
      } else if (url.includes('mytestsite.com/assets/orange_small.jpg')) {
        request.respond({
          status: 200,
          contentType: 'image/jpeg',
          body: fs.readFileSync(
            path.join(__dirname, 'assets/orange_small.jpg')
          ),
        });
      } else if (url.includes('mytestsite.com/assets/safe.jpg')) {
        request.respond({
          status: 200,
          contentType: 'image/jpeg',
          body: fs.readFileSync(path.join(__dirname, 'assets/safe.jpg')),
        });
      } else {
        request.continue();
      }
    });

    // 2. Enable AI Consent via Background Worker
    const workerTarget = await browser.waitForTarget(
      (target) => target.type() === 'service_worker'
    );
    const worker = await workerTarget.worker();
    await worker.evaluate(() => {
      chrome.storage.local.set({
        settings: {
          enabledGlobal: true,
          aiMode: 'balanced',
          aiConsent: true,
        },
      });
    });
    console.log('Enabled AI Consent via background worker');
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 3. Navigate to test page
    console.log('Navigating to test page...');
    await page.goto('http://mytestsite.com/test', {
      waitUntil: 'networkidle0',
    });

    // 3. Wait for filtering (Text/Context)
    console.log('Waiting for filtering...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 4. Verify Text Match
    const textMatchResult = await page.evaluate(() => {
      const article = document.querySelector('#text-match article');
      return {
        hidden:
          article &&
          (window.getComputedStyle(article).display === 'none' ||
            article.dataset.orangeFilterHidden === 'true'),
      };
    });
    console.log('Text Match Result:', textMatchResult);
    expect(textMatchResult.hidden).toBe(true);

    // 5. Verify Alt Match
    const altMatchResult = await page.evaluate(() => {
      const img = document.querySelector('#img-alt-match');
      return {
        hidden:
          img &&
          (window.getComputedStyle(img).display === 'none' ||
            img.dataset.orangeFilterHidden === 'true'),
      };
    });
    console.log('Alt Match Result:', altMatchResult);
    expect(altMatchResult.hidden).toBe(true);

    // 6. Verify AI Match (This might take longer for cold start)
    console.log('Waiting for AI filtering (15s)...');
    await new Promise((resolve) => setTimeout(resolve, 15000));

    const aiMatchResult = await page.evaluate(() => {
      const img = document.querySelector('#img-ai-match');
      return {
        hidden:
          img &&
          (window.getComputedStyle(img).display === 'none' ||
            img.dataset.orangeFilterHidden === 'true'),
        scanning: img && img.dataset.orangeFilterScanning === 'true',
        debug: img && img.dataset.orangeFilterDebug,
        error: img && img.dataset.orangeError,
      };
    });
    console.log('AI Match Result:', aiMatchResult);
    // Note: AI might fail to hide if confidence is low, but should not crash
    expect(aiMatchResult.hidden).toBe(true);

    // 7. Verify Safe Image is NOT hidden
    const safeResult = await page.evaluate(() => {
      const img = document.querySelector('#img-ai-no-match');
      return {
        visible:
          img &&
          window.getComputedStyle(img).display !== 'none' &&
          img.dataset.orangeFilterHidden !== 'true',
      };
    });
    console.log('Safe Image Result:', safeResult);
    expect(safeResult.visible).toBe(true);
  }, 40000);
});
