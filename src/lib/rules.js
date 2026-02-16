/**
 * Generates declarativeNetRequest rules from settings and lists.
 * @param {Object} lists - The lists object from storage { whitelist: [], userKeywords: [] }
 * @param {Object} settings - The settings object { enabledGlobal: boolean }
 * @returns {Array} - Array of chrome.declarativeNetRequest.Rule objects
 */
export function generateRules(lists, settings = {}) {
  if (settings.enabledGlobal === false) {
    return [];
  }

  const rules = [];
  let idCounter = 1;

  // 1. Whitelist Rules (Priority 100)
  // Action: allow
  // These allow navigation TO the whitelisted domain
  if (lists.whitelist && Array.isArray(lists.whitelist)) {
    lists.whitelist.forEach((domain) => {
      if (!domain) return;
      rules.push({
        id: idCounter++,
        priority: 100,
        action: { type: 'allow' },
        condition: {
          urlFilter: `||${domain}^`,
          resourceTypes: ['main_frame'],
        },
      });
    });
  }

  // 2. Keyword Block Rules (Priority 10)
  // Action: block
  // Blocks navigation if URL contains keyword
  if (lists.userKeywords && Array.isArray(lists.userKeywords)) {
    lists.userKeywords.forEach((keyword) => {
      if (!keyword) return;
      rules.push({
        id: idCounter++,
        priority: 10,
        action: { type: 'block' },
        condition: {
          urlFilter: `*${keyword}*`,
          resourceTypes: ['main_frame'],
          isUrlFilterCaseSensitive: false,
          excludedDomains: [
            'google.com',
            'bing.com',
            'duckduckgo.com',
            'yahoo.com',
            'baidu.com',
            'yandex.ru',
            'yandex.com',
          ],
        },
      });
    });
  }

  return rules;
}
