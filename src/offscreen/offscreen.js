/**
 * Offscreen Document - The GPU Worker
 * Handles heavy ML inference using TensorFlow.js (MobileNet V3 Small)
 */
import {
  tidy,
  zeros,
  browser,
  image as tfImage,
  setBackend,
  env,
} from '@tensorflow/tfjs-core';
import { loadLayersModel } from '@tensorflow/tfjs-layers';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';

console.debug('Offscreen document loaded');

let model = null;
let labels = [];
let isInitializing = false;
let initPromise = null;

const MODEL_PATH = 'assets/models/tm-model/model.json';
const METADATA_PATH = 'assets/models/tm-model/metadata.json';
const WASM_DIR = 'assets/wasm/';

async function initializeModel() {
  if (model) return;
  if (isInitializing) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    try {
      console.debug('Loading TensorFlow.js model (Teachable Machine)...');

      // Disable multi-threading BEFORE backend init to prevent blob URL
      // workers, which Chrome MV3 CSP blocks (blob: not allowed in script-src).
      env().set('WASM_HAS_MULTITHREAD_SUPPORT', false);
      setWasmPaths(chrome.runtime.getURL(WASM_DIR));
      await setBackend('wasm');
      console.debug('Using WASM backend (SIMD, single-threaded)');

      // Load Metadata to get labels
      const metadataRes = await fetch(chrome.runtime.getURL(METADATA_PATH));
      if (!metadataRes.ok) throw new Error('Failed to load metadata.json');
      const metadata = await metadataRes.json();
      labels = metadata.labels;
      console.debug('Model labels:', labels);

      // Load Model
      model = await loadLayersModel(chrome.runtime.getURL(MODEL_PATH));

      // Warmup
      tidy(() => {
        model.predict(zeros([1, 224, 224, 3]));
      });

      console.debug('Teachable Machine model initialized successfully (WASM)');
    } catch (error) {
      console.warn('Failed to initialize TensorFlow model:', error);
      throw error;
    } finally {
      isInitializing = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Preprocesses the image and runs prediction
 */
async function predict(imageElement, threshold = 0.85) {
  if (!model) return { isBlocked: false, confidence: 0 };

  return tidy(() => {
    let tensor = browser.fromPixels(imageElement);
    if (!tensor || !tensor.shape || tensor.shape.length !== 3) {
      return { isBlocked: false, confidence: 0 };
    }

    tensor = tfImage.resizeBilinear(tensor, [224, 224]);
    tensor = tensor.toFloat().div(127.5).sub(1);
    tensor = tensor.expandDims(0);

    const predictions = model.predict(tensor);
    const probabilities = predictions.dataSync();

    const orangeIndex = labels.indexOf('Orange');
    if (orangeIndex === -1) {
      console.warn('Label "Orange" not found in metadata');
      return { isBlocked: false, confidence: 0 };
    }

    const orangeScore = probabilities[orangeIndex];
    const isBlocked = orangeScore > threshold;

    return {
      isBlocked,
      confidence: orangeScore,
      layer: 'teachable-machine',
    };
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') {
    return false;
  }

  handleMessage(message).then(sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    case 'PING':
      return { success: true, data: 'PONG' };

    case 'SCAN_IMAGE':
      if (!model) {
        try {
          await initializeModel();
        } catch {
          return { success: false, error: 'Model initialization failed' };
        }
      }

      try {
        // Chrome messaging serializes everything to JSON — only base64 strings
        // survive the transfer. Blob/ImageBitmap cannot be passed this way.
        const data = message.data.data;
        if (!data || typeof data !== 'string') {
          return { success: false, error: 'No image data' };
        }

        const img = new Image();
        img.src = data;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('Image failed to load'));
        });

        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          return { success: false, error: 'Invalid image dimensions' };
        }

        // Determine threshold based on sensitivity
        let threshold = 0.85;
        if (message.data.sensitivity === 'strict') {
          threshold = 0.65;
        } else if (message.data.sensitivity === 'light') {
          threshold = 0.95;
        } else if (message.data.sensitivity === 'pictures-only') {
          threshold = 0.85;
        }

        const result = await predict(img, threshold);
        return { success: true, ...result };
      } catch (error) {
        return { success: false, error: error.message };
      }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}
