const puppeteer = require('puppeteer');
const path = require('path');
const { execSync } = require('child_process');

(async () => {
  // 1. Build the extension first
  console.log('🔨 Building extension...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Build failed.');
    process.exit(1);
  }

  const EXTENSION_PATH = path.resolve(__dirname, '../dist');

  console.log('🚀 Launching Chrome with extension...');

  const browser = await puppeteer.launch({
    headless: false, // We want to see the browser
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  // Function to hook console logs from a page/target
  const hookConsole = async (target) => {
    const page = await target.page();
    if (!page) return;

    page.on('console', (msg) => {
      const type = msg.type().toUpperCase();
      const text = msg.text();
      // Colorize output for better readability
      if (type === 'ERROR') console.error(`[BROWSER][${type}] ${text}`);
      else if (type === 'WARNING') console.warn(`[BROWSER][${type}] ${text}`);
      else console.log(`[BROWSER][${type}] ${text}`);
    });

    page.on('pageerror', (err) => {
      console.error(`[BROWSER][EXCEPTION] ${err.message}`);
    });
  };

  // Listen for new targets (popup, offscreen, options, tabs)
  browser.on('targetcreated', async (target) => {
    const url = target.url();
    // console.log(`[TARGET CREATED] ${target.type()} - ${url}`);

    if (
      target.type() === 'page' ||
      target.type() === 'service_worker' ||
      target.type() === 'other'
    ) {
      // 'other' often covers offscreen documents in some versions, or 'page'
      // Service workers (background.js) need special handling often, but puppeteer handles them better now.
      try {
        if (target.type() === 'service_worker') {
          const worker = await target.worker();
          worker.on('console', (msg) =>
            console.log(`[BACKGROUND] ${msg.text()}`)
          );
          worker.on('error', (err) =>
            console.error(`[BACKGROUND][ERROR] ${err}`)
          );
        } else {
          await hookConsole(target);
        }
      } catch (e) {
        // Ignore errors hooking into transient targets
      }
    }
  });

  console.log('👀 Watching logs... Press Ctrl+C to exit.');

  // Open a dummy page to trigger content scripts
  const page = await browser.newPage();
  await page.goto('https://example.com');
})();
