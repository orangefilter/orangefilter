import { getStorage } from './storage';
import { generateRules } from './rules';

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
const OFFSCREEN_TIMEOUT = 30 * 1000; // 30 seconds

let creating; // A global promise to avoid concurrency issues
let offscreenTimer = null;

export async function updateRules() {
  try {
    const data = await getStorage();
    const newRules = generateRules(data.lists, data.settings);

    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existingRules.map((rule) => rule.id);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: newRules,
    });

    console.log(`Rules updated. Active rules: ${newRules.length}`);
    return newRules.length;
  } catch (error) {
    console.error('Failed to update rules:', error);
    throw error;
  }
}

async function hasOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  return existingContexts.length > 0;
}

async function closeOffscreenDocument() {
  if (creating) {
    await creating;
  }

  try {
    if (await hasOffscreenDocument()) {
      await chrome.offscreen.closeDocument();
      console.log('Offscreen document closed due to inactivity.');
    }
  } catch (e) {
    console.log('Offscreen document already closed or error:', e);
  }
}

/**
 * Ensures an offscreen document exists.
 */
export async function setupOffscreen() {
  const path = OFFSCREEN_DOCUMENT_PATH;

  if (await hasOffscreenDocument()) {
    // Clear any pending close timer since we are using it
    clearTimeout(offscreenTimer);
    return;
  }

  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['DOM_SCRAPING'], // Required reason for ML/DOM processing
      justification: 'Running local ML models for image content analysis.',
    });

    try {
      await creating;
      console.log('Offscreen document created');
    } catch (err) {
      // if it already exists, that's fine (Chrome might throw if we race check and create)
      if (!err.message.startsWith('Only a single offscreen')) {
        throw err;
      }
    }
    creating = null;
  }
  // Clear any pending close timer since we are using it
  clearTimeout(offscreenTimer);
}

/**
 * Sends a message to the offscreen document.
 */
export async function sendMessageToOffscreen(type, data = {}) {
  await setupOffscreen();

  try {
    const res = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type,
      data,
    });
    return res;
  } finally {
    // Restart timer
    clearTimeout(offscreenTimer);
    offscreenTimer = setTimeout(closeOffscreenDocument, OFFSCREEN_TIMEOUT);
  }
}
