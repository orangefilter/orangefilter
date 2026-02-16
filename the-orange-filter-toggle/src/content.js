import { getStorage } from './lib/storage';
import { scanAndFilter } from './lib/dom';

let keywords = [];
let observer = null;

async function init() {
  try {
    const data = await getStorage();

    // Check if disabled for this site
    const domain = window.location.hostname;
    if (
      data.settings.enabledGlobal === false ||
      data.lists.whitelist.includes(domain)
    ) {
      console.log('Orange Filter: Disabled for this site/globally');
      return;
    }

    keywords = data.lists.userKeywords;

    if (keywords.length > 0) {
      // Initial scan
      scanAndFilter(keywords, data.settings);

      // Observe for dynamic content
      observer = new MutationObserver(
        debounce(() => {
          scanAndFilter(keywords, data.settings);
        }, 500)
      );

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  } catch (error) {
    if (error.message.includes('Extension context invalidated')) {
      console.log(
        'Orange Filter: Context invalidated. Please refresh the page.'
      );
    } else {
      console.error('Orange Filter Init Error:', error);
    }
  }
}

// Cleanup on unload
window.addEventListener('pagehide', () => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

init();
