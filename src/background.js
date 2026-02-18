import { updateRules, sendMessageToOffscreen } from './lib/backgroundLogic';

console.debug('Orange Filter Background Service Started');

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.debug('Extension installed/updated. Initializing...');
  await updateRules();
  await updateBadge();

  // Test offscreen bridge
  try {
    const response = await sendMessageToOffscreen('PING');
    console.debug('Offscreen Bridge Test:', response);
  } catch {
    // Offscreen bridge test can fail on first install — non-critical
  }
});

async function updateBadge() {
  const data = await (async function () {
    return new Promise((resolve) => {
      chrome.storage.local.get('stats', (result) => {
        resolve(result.stats || {});
      });
    });
  })();
  const count = data.blockedCount || 0;
  chrome.action.setBadgeText({ text: count > 0 ? count.toString() : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
}

// Also update on startup (not just install)
chrome.runtime.onStartup.addListener(updateBadge);
// And when storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.lists) {
      console.debug('Lists changed. Updating rules...');
      updateRules();
    }
    if (changes.stats) {
      updateBadge();
    }
  }
});

let modelStatus = 'idle'; // idle, loading, ready, error

// Listen for messages (from Content Script, Popup, or Options)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'background') {
    if (message.type === 'GET_MODEL_STATUS') {
      sendResponse({ status: modelStatus });
      return false;
    }
    handleBackgroundMessage(message, sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

async function handleBackgroundMessage(message, _sender) {
  switch (message.type) {
    case 'CHECK_IMAGE':
      try {
        if (modelStatus === 'idle') {
          modelStatus = 'loading';
          // Start initialization in background
          sendMessageToOffscreen('PING')
            .then(() => {
              modelStatus = 'ready';
            })
            .catch(() => {
              modelStatus = 'error';
            });
        }
        let imageData = message.data.data;

        // If no data provided, try to fetch and convert to base64.
        // Chrome messaging serializes to JSON so only strings (base64) work.
        if (!imageData && message.data.url) {
          try {
            const response = await fetch(message.data.url);
            const blob = await response.blob();
            imageData = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
          } catch (fetchError) {
            return { success: false, error: fetchError.message };
          }
        }

        if (!imageData) {
          return { success: false, error: 'No image data available' };
        }

        // Forward to offscreen (always base64 string)
        return await sendMessageToOffscreen('SCAN_IMAGE', {
          type: 'base64',
          data: imageData,
          sensitivity: message.data.sensitivity,
        });
      } catch {
        return { success: false, error: 'Image check failed' };
      }
    default:
      return { success: false, error: 'Unknown background message type' };
  }
}
