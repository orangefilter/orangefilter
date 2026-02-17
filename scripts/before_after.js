/**
 * Before/After screenshot test
 * Takes screenshots of real websites with and without the extension.
 * Covers: search engines, news sites, RSS/aggregators, blogs, video.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '..', 'dist');
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');

const SITES = [
  // Search engines
  {
    name: '01_google_trump_news',
    url: 'https://www.google.com/search?q=trump&tbm=nws',
    wait: 3000,
    category: 'search',
  },
  {
    name: '02_google_trump_web',
    url: 'https://www.google.com/search?q=donald+trump',
    wait: 3000,
    category: 'search',
  },
  {
    name: '03_bing_trump',
    url: 'https://www.bing.com/search?q=trump+news',
    wait: 3000,
    category: 'search',
  },

  // US news
  {
    name: '04_foxnews',
    url: 'https://www.foxnews.com',
    wait: 5000,
    category: 'news',
  },
  { name: '05_cnn', url: 'https://www.cnn.com', wait: 5000, category: 'news' },
  {
    name: '06_reuters',
    url: 'https://www.reuters.com',
    wait: 5000,
    category: 'news',
  },

  // International news
  {
    name: '07_svt',
    url: 'https://www.svt.se',
    wait: 5000,
    category: 'news-intl',
  },
  {
    name: '08_bbc',
    url: 'https://www.bbc.com/news',
    wait: 5000,
    category: 'news-intl',
  },

  // RSS / aggregator style
  {
    name: '09_reddit_news',
    url: 'https://www.reddit.com/r/news/',
    wait: 5000,
    category: 'aggregator',
  },
  {
    name: '10_hackernews',
    url: 'https://news.ycombinator.com',
    wait: 3000,
    category: 'aggregator',
  },

  // Video
  {
    name: '11_youtube_trump',
    url: 'https://www.youtube.com/results?search_query=trump',
    wait: 5000,
    category: 'video',
  },

  // Non-trump content (should remain UNTOUCHED)
  {
    name: '12_google_weather',
    url: 'https://www.google.com/search?q=weather+today',
    wait: 3000,
    category: 'control',
  },
  {
    name: '13_wikipedia',
    url: 'https://en.wikipedia.org/wiki/Main_Page',
    wait: 3000,
    category: 'control',
  },
];

async function dismissCookies(page) {
  try {
    await page.evaluate(() => {
      const selectors = [
        '[data-testid="GDPR-accept"]',
        '#onetrust-accept-btn-handler',
        '.fc-cta-consent',
        'button[aria-label="Accept"]',
        'button[aria-label="Accept all"]',
        'button[aria-label="Acceptera"]',
        'button[aria-label="Acceptera alla"]',
        '.css-47sehv',
        '#didomi-notice-agree-button',
        '[data-cookie-banner] button',
        '.qc-cmp2-summary-buttons button:last-child',
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        'button.agree-button',
        '[class*="cookie"] button[class*="accept"]',
        '[class*="consent"] button[class*="accept"]',
      ];
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn) {
          btn.click();
          break;
        }
      }
    });
    await new Promise((r) => setTimeout(r, 1000));
  } catch (e) {
    /* no cookie banner */
  }
}

async function takeScreenshots(label, browser) {
  for (const site of SITES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    try {
      console.log(
        `[${label}] Loading ${site.name} (${site.category}): ${site.url}`
      );
      await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise((r) => setTimeout(r, site.wait));

      await dismissCookies(page);

      // Scroll down to load more content
      await page.evaluate(() => window.scrollBy(0, 400));
      await new Promise((r) => setTimeout(r, 2000));

      // If extension is loaded, give content script extra time to filter
      if (label === 'after') {
        await new Promise((r) => setTimeout(r, 3000));
      }

      const filename = `${SCREENSHOT_DIR}/${label}_${site.name}.png`;
      await page.screenshot({ path: filename, fullPage: false });
      console.log(`  -> ${filename}`);

      // Also take a full-page shot for detailed comparison
      const fullFilename = `${SCREENSHOT_DIR}/${label}_${site.name}_full.png`;
      await page.screenshot({ path: fullFilename, fullPage: true });
      console.log(`  -> ${fullFilename} (full page)`);

      // Collect DOM filtering metrics for "after" screenshots
      if (label === 'after') {
        const hiddenCount = await page.evaluate(() => {
          return document.querySelectorAll('[data-orange-filter-hidden]')
            .length;
        });
        site._hiddenCount = hiddenCount;
        console.log(
          `  -> DOM: ${hiddenCount} element(s) with [data-orange-filter-hidden]`
        );
      }
    } catch (err) {
      console.error(`  ERROR on ${site.name}: ${err.message}`);
    }
    await page.close();
  }
}

(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // Clean old screenshots
  const old = fs.readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith('.png'));
  old.forEach((f) => fs.unlinkSync(path.join(SCREENSHOT_DIR, f)));
  console.log(`Cleaned ${old.length} old screenshots.\n`);

  // ---- BEFORE (no extension) ----
  console.log('=== BEFORE (no extension) ===\n');
  const browserBefore = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,900',
    ],
  });
  await takeScreenshots('before', browserBefore);
  await browserBefore.close();

  // ---- AFTER (with extension) ----
  console.log('\n=== AFTER (with extension loaded) ===\n');
  const browserAfter = await puppeteer.launch({
    headless: false, // Extensions need headed mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--window-size=1280,900',
    ],
  });

  // Let extension initialize fully
  await new Promise((r) => setTimeout(r, 4000));

  await takeScreenshots('after', browserAfter);
  await browserAfter.close();

  // Print summary
  const files = fs
    .readdirSync(SCREENSHOT_DIR)
    .filter((f) => f.endsWith('.png') && !f.includes('_full'));
  const befores = files.filter((f) => f.startsWith('before_'));
  const afters = files.filter((f) => f.startsWith('after_'));

  console.log('\n=== RESULTS ===\n');
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/`);
  console.log(`Before: ${befores.length} screenshots`);
  console.log(`After:  ${afters.length} screenshots`);
  console.log('\nCompare pairs:');
  befores.forEach((b) => {
    const siteName = b.replace('before_', '');
    const a = `after_${siteName}`;
    const hasAfter = afters.includes(a);
    console.log(`  ${b}  <->  ${hasAfter ? a : '(missing)'}`);
  });

  console.log('\nControl sites (should look identical before/after):');
  console.log('  - 12_google_weather');
  console.log('  - 13_wikipedia');

  // DOM validation report
  console.log('\n=== DOM VALIDATION ===\n');
  const filterCategories = [
    'search',
    'news',
    'news-intl',
    'aggregator',
    'video',
  ];
  let passes = 0;
  let failures = 0;

  SITES.forEach((site) => {
    const count = site._hiddenCount || 0;
    const isControl = site.category === 'control';
    const expectFiltering = filterCategories.includes(site.category);

    let status;
    if (isControl && count === 0) {
      status = 'PASS';
      passes++;
    } else if (isControl && count > 0) {
      status = 'FAIL (control site has filtered elements)';
      failures++;
    } else if (expectFiltering && count > 0) {
      status = 'PASS';
      passes++;
    } else if (expectFiltering && count === 0) {
      status = 'FAIL (no elements filtered)';
      failures++;
    } else {
      status = 'SKIP';
    }

    console.log(
      `  [${status}] ${site.name} (${site.category}): ${count} hidden`
    );
  });

  console.log(
    `\nTotal: ${passes} passed, ${failures} failed out of ${SITES.length} sites`
  );
})();
