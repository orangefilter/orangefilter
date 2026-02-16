const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../src/assets/models');

const FILES = [
  {
    name: 'face_embedder.task',
    urls: [
      'https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite',
      'https://storage.googleapis.com/mediapipe-models/face_embedder/face_embedder/float32/1/face_embedder.task',
    ],
    dir: ASSETS_DIR,
  },
  // SigLIP files
  {
    name: 'config.json',
    urls: [
      'https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/config.json',
    ],
    dir: path.join(ASSETS_DIR, 'siglip-base-patch16-224'),
  },
  {
    name: 'preprocessor_config.json',
    urls: [
      'https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/preprocessor_config.json',
    ],
    dir: path.join(ASSETS_DIR, 'siglip-base-patch16-224'),
  },
  {
    name: 'tokenizer.json',
    urls: [
      'https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/tokenizer.json',
    ],
    dir: path.join(ASSETS_DIR, 'siglip-base-patch16-224'),
  },
  {
    name: 'tokenizer_config.json',
    urls: [
      'https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/tokenizer_config.json',
    ],
    dir: path.join(ASSETS_DIR, 'siglip-base-patch16-224'),
  },
  // We prefer the quantized model as per spec (q8)
  {
    name: 'model_quantized.onnx',
    urls: [
      'https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/onnx/model_quantized.onnx',
      'https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/model_quantized.onnx',
      'https://huggingface.co/Xenova/siglip-base-patch16-224/resolve/main/onnx/model.onnx', // Fallback to non-quantized if q8 missing (unlikely but safe)
    ],
    dir: path.join(ASSETS_DIR, 'siglip-base-patch16-224'),
  },
];

async function downloadFile(fileInfo) {
  if (!fs.existsSync(fileInfo.dir)) {
    fs.mkdirSync(fileInfo.dir, { recursive: true });
  }

  const filePath = path.join(fileInfo.dir, fileInfo.name);

  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    if (stats.size > 1024) {
      console.log(`[SKIP] ${fileInfo.name} already exists.`);
      return;
    }
    console.log(
      `[OVERWRITE] ${fileInfo.name} exists but is small (${stats.size}b). Re-downloading...`
    );
  }

  let success = false;
  for (const url of fileInfo.urls) {
    console.log(`[DOWNLOADING] ${fileInfo.name} from ${url}...`);
    try {
      const response = await fetch(url);
      if (response.ok) {
        await saveStream(response, filePath);
        console.log(`[SUCCESS] ${fileInfo.name} downloaded.`);
        success = true;
        break;
      } else {
        console.log(`[WARN] Failed ${url}: ${response.status}`);
      }
    } catch (e) {
      console.log(`[WARN] Error fetching ${url}: ${e.message}`);
    }
  }

  if (!success) {
    console.error(
      `[ERROR] Failed to download ${fileInfo.name} from any source.`
    );
    // process.exit(1); // Don't exit, try next file
  }
}

async function saveStream(response, filePath) {
  const fileStream = fs.createWriteStream(filePath);
  const stream = require('stream');
  const { promisify } = require('util');
  const pipeline = promisify(stream.pipeline);
  await pipeline(response.body, fileStream);
}

async function main() {
  console.log('Starting model downloads...');
  for (const file of FILES) {
    await downloadFile(file);
  }
  console.log('All downloads complete.');
}

main();
