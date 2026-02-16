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
} from '@tensorflow/tfjs-core';
import { loadLayersModel } from '@tensorflow/tfjs-layers';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';

console.log('Offscreen document loaded');

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
      console.log('Loading TensorFlow.js model (Teachable Machine)...');

      // 1. Verify Assets Exist (Fail Fast)
      const assetChecks = [
        { url: chrome.runtime.getURL(METADATA_PATH), name: 'Metadata' },
        { url: chrome.runtime.getURL(MODEL_PATH), name: 'Model JSON' },
        {
          url: chrome.runtime.getURL(WASM_DIR + 'tfjs-backend-wasm.wasm'),
          name: 'WASM Backend',
        },
        {
          url: chrome.runtime.getURL(WASM_DIR + 'tfjs-backend-wasm-simd.wasm'),
          name: 'WASM SIMD',
        },
        {
          url: chrome.runtime.getURL(
            WASM_DIR + 'tfjs-backend-wasm-threaded-simd.wasm'
          ),
          name: 'WASM Threaded',
        },
      ];

      for (const check of assetChecks) {
        try {
          const res = await fetch(check.url, { method: 'HEAD' });
          if (!res.ok) {
            console.warn(
              `Asset warning: ${check.name} might be missing (${check.url})`
            );
          } else {
            console.log(`Asset verified: ${check.name}`);
          }
        } catch (e) {
          console.warn(`Asset check failed for ${check.name}: ${e.message}`);
        }
      }

      // Configure WASM backend
      setWasmPaths(chrome.runtime.getURL(WASM_DIR));
      await setBackend('wasm');
      console.log('Using WASM backend');

      // Load Metadata to get labels
      const metadataRes = await fetch(chrome.runtime.getURL(METADATA_PATH));
      if (!metadataRes.ok) throw new Error('Failed to load metadata.json');
      const metadata = await metadataRes.json();
      labels = metadata.labels;
      console.log('Model labels:', labels);

      // Load Model
      model = await loadLayersModel(chrome.runtime.getURL(MODEL_PATH));

      // Warmup
      tidy(() => {
        model.predict(zeros([1, 224, 224, 3]));
      });

      console.log('Teachable Machine model initialized successfully (WASM)');
    } catch (error) {
      console.error('Failed to initialize TensorFlow model:', error);
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
    // 1. Convert to Tensor
    let tensor = browser.fromPixels(imageElement);

    // 2. Resize to 224x224
    tensor = tfImage.resizeBilinear(tensor, [224, 224]);

    // 3. Normalize:
    // Teachable Machine models typically expect inputs in [-1, 1] range.
    // (pixel / 127.5) - 1
    tensor = tensor.toFloat().div(127.5).sub(1);

    // 4. Expand dims to batch [1, 224, 224, 3]
    tensor = tensor.expandDims(0);

    // 5. Predict
    const predictions = model.predict(tensor);
    const probabilities = predictions.dataSync(); // Float32Array

    // 6. Map to labels
    // Labels are loaded from metadata: e.g., ["Orange", "Safe", "Hard negatives"]
    const orangeIndex = labels.indexOf('Orange');

    if (orangeIndex === -1) {
      console.error('Label "Orange" not found in metadata');
      return { isBlocked: false, confidence: 0 };
    }

    const orangeScore = probabilities[orangeIndex];

    // Threshold check
    const isBlocked = orangeScore > threshold;

    console.log(
      `Prediction: ${orangeScore} (Threshold: ${threshold}) -> Blocked: ${isBlocked}`
    );

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
        let img;

        if (message.data.type === 'blob') {
          // Modern path: Blob -> ImageBitmap
          img = await createImageBitmap(message.data.data);
        } else if (message.data.type === 'base64') {
          // Legacy path: Base64 -> Image
          img = new Image();
          img.src = message.data.data;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
        } else {
          return { success: false, error: 'Unsupported image data type' };
        }

        // Determine threshold based on sensitivity
        let threshold = 0.85; // Default balanced
        if (message.data.sensitivity === 'strict') {
          threshold = 0.65;
        } else if (message.data.sensitivity === 'light') {
          threshold = 0.95;
        } else if (message.data.sensitivity === 'pictures-only') {
          threshold = 0.85;
        }

        // We use a base threshold of 0.65 for detection to allow "grey zone" handling in the content script,
        // but we still respect the sensitivity-based threshold for the 'isBlocked' flag.
        const result = await predict(img, threshold);

        // Clean up ImageBitmap to free memory
        if (img.close) {
          img.close();
        }

        return { success: true, ...result };
      } catch (error) {
        console.error('Scan Error:', error);
        return { success: false, error: error.message };
      }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}
