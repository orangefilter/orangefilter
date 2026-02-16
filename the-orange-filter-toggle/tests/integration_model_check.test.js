const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

describe('New Model Integration Check', () => {
  let browser;
  let page;
  const EXTENSION_PATH = path.resolve(__dirname, '../dist');
  const testPagePath = path.resolve(__dirname, 'test_page.html');
  const testPageContent = fs.readFileSync(testPagePath, 'utf8');

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false, // Use new headless mode
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-unsafe-webgpu', // Helps with some TFJS backends if available
      ],
    });
  }, 60000);

  afterAll(async () => {
    if (browser) await browser.close();
  });

  test('Should use "teachable-machine" layer for prediction', async () => {
    page = await browser.newPage();
    page.on('console', (msg) => console.log('[PAGE LOG]:', msg.text()));

    // 1. Intercept requests to serve local assets
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('mytestsite.com/test')) {
        request.respond({
          status: 200,
          contentType: 'text/html',
          body: testPageContent,
        });
      } else if (url.includes('orange_small.jpg')) {
        request.respond({
          status: 200,
          contentType: 'image/jpeg',
          body: fs.readFileSync(
            path.join(__dirname, 'assets/orange_small.jpg')
          ),
        });
      } else if (url.includes('safe.jpg')) {
        request.respond({
          status: 200,
          contentType: 'image/jpeg',
          body: fs.readFileSync(path.join(__dirname, 'assets/safe.jpg')),
        });
      } else {
        request.continue();
      }
    });

    // 2. Enable AI settings
    console.log('Waiting for service worker...');
    const workerTarget = await browser.waitForTarget(
      (target) => target.type() === 'service_worker',
      { timeout: 60000 }
    );
    console.log('Service worker found.');
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

    // 3. Navigate
    await page.goto('http://mytestsite.com/test', {
      waitUntil: 'domcontentloaded',
    });

    // 4. Wait for AI processing
    // We poll for the debug attribute
    try {
      await page.waitForFunction(
        () => {
          const img = document.querySelector('#img-ai-match');
          return img && img.dataset.orangeFilterDebug;
        },
        { timeout: 40000 }
      );
    } catch (e) {
      console.log(
        'Timeout waiting for debug attribute. checking content anyway.'
      );
    }

    // 5. Check the debug info
    const debugInfo = await page.evaluate(() => {
      const img = document.querySelector('#img-ai-match');
      return img ? img.dataset.orangeFilterDebug : null;
    });

    console.log('Debug Info:', debugInfo);
    expect(debugInfo).toBeTruthy();

    const parsed = JSON.parse(debugInfo);
    expect(parsed.layer).toBe('teachable-machine');
    expect(parsed.isBlocked).toBe(true);
    // Teachable machine model should give high confidence for orange image
    expect(parsed.confidence).toBeGreaterThan(0.85);
  }, 60000);
});
