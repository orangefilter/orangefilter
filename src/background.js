import { updateRules, sendMessageToOffscreen } from './lib/backgroundLogic';

console.log('Orange Filter Background Service Started');

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Extension installed/updated. Initializing...');
  await updateRules();
  await updateBadge();

  // Test offscreen bridge
  try {
    const response = await sendMessageToOffscreen('PING');
    console.log('Offscreen Bridge Test:', response);
  } catch (e) {
    console.error('Offscreen Bridge Test Failed:', e);
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
      console.log('Lists changed. Updating rules...');
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
        console.error('Background message handler failed:', error);
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
        let imageType = message.data.type || 'blob';

        // If no data provided (legacy or failed in content script), try to fetch here
        if (!imageData && message.data.url) {
          try {
            const response = await fetch(message.data.url);
            imageData = await response.blob();
            imageType = 'blob';
          } catch (fetchError) {
            console.error('Background fetch failed:', fetchError);
            return { success: false, error: fetchError.message };
          }
        }

        if (!imageData) {
          return { success: false, error: 'No image data available' };
        }

        // Forward to offscreen
        return await sendMessageToOffscreen('SCAN_IMAGE', {
          type: imageType,
          data: imageData,
          sensitivity: message.data.sensitivity,
        });
      } catch (error) {
        console.error('Error fetching image for check:', error);
        return { success: false, error: error.message };
      }
    default:
      return { success: false, error: 'Unknown background message type' };
  }
}
