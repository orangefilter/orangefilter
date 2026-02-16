import { getStorage, setStorage } from '../lib/storage';

const globalToggle = document.getElementById('globalToggle');
const siteToggle = document.getElementById('siteToggle');
const aiToggle = document.getElementById('aiToggle');
const statsCount = document.getElementById('statsCount');
const openOptions = document.getElementById('openOptions');

async function init() {
  const data = await getStorage();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = new URL(tab.url);
  const domain = url.hostname;

  // Initialize UI
  globalToggle.checked = data.settings.enabledGlobal;
  aiToggle.checked = data.settings.aiMode !== 'none';

  // Site toggle is "Enabled on this site"
  // If whitelisted, it's NOT enabled
  siteToggle.checked = !data.lists.whitelist.includes(domain);

  // Stats
  statsCount.textContent = (data.stats?.blockedCount || 0).toLocaleString();

  // Model Status
  const aiStatus = document.getElementById('aiStatus');
  const modelStatusText = document.getElementById('modelStatusText');

  const updateModelStatus = async () => {
    if (data.settings.aiMode !== 'none') {
      aiStatus.style.display = 'block';
      chrome.runtime.sendMessage(
        { target: 'background', type: 'GET_MODEL_STATUS' },
        (response) => {
          if (response && response.status) {
            modelStatusText.textContent =
              response.status.charAt(0).toUpperCase() +
              response.status.slice(1);
            if (response.status === 'loading') {
              modelStatusText.style.color = '#ff9800';
            } else if (response.status === 'ready') {
              modelStatusText.style.color = '#4caf50';
            } else if (response.status === 'error') {
              modelStatusText.style.color = '#f44336';
            }
          }
        }
      );
    } else {
      aiStatus.style.display = 'none';
    }
  };

  updateModelStatus();
  setInterval(updateModelStatus, 5000);

  // Listeners
  globalToggle.addEventListener('change', async () => {
    data.settings.enabledGlobal = globalToggle.checked;
    await setStorage(data);
  });

  aiToggle.addEventListener('change', async () => {
    if (aiToggle.checked && !data.settings.aiConsent) {
      const consent = confirm(
        'Privacy Notice: Enabling AI Filtering will process images locally on your device. ' +
          'No image data leaves your browser. This may impact battery life and performance. ' +
          'Do you consent to local AI processing?'
      );

      if (consent) {
        data.settings.aiConsent = true;
        data.settings.aiMode = 'mobilenet';
        // Trigger load
        chrome.runtime.sendMessage({
          target: 'background',
          type: 'CHECK_IMAGE',
          data: { url: '' },
        });
      } else {
        aiToggle.checked = false;
        return;
      }
    } else if (aiToggle.checked) {
      data.settings.aiMode = 'mobilenet';
      // Trigger load
      chrome.runtime.sendMessage({
        target: 'background',
        type: 'CHECK_IMAGE',
        data: { url: '' },
      });
    } else {
      data.settings.aiMode = 'none';
    }
    console.log('Saving settings:', data.settings);
    await setStorage(data);
  });

  siteToggle.addEventListener('change', async () => {
    const isEnabled = siteToggle.checked;
    if (isEnabled) {
      // Remove from whitelist
      data.lists.whitelist = data.lists.whitelist.filter((d) => d !== domain);
    } else {
      // Add to whitelist
      if (!data.lists.whitelist.includes(domain)) {
        data.lists.whitelist.push(domain);
      }
    }
    await setStorage(data);
  });

  openOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  const donateBtn = document.getElementById('donateBtn');
  if (donateBtn) {
    donateBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://bjorn12341234.github.io/adblocker' });
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
