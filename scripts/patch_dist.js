const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../dist/offscreen.js');

if (!fs.existsSync(filePath)) {
  console.error('dist/offscreen.js not found');
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Regex to match the default CDN path assignment
// Matches: ONNX_ENV.wasm.wasmPaths = `https://cdn.jsdelivr.net...`;
const regex =
  /ONNX_ENV\.wasm\.wasmPaths\s*=\s*`https:\/\/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers@\$\{[^}]+\}\/dist\/`;/g;

if (regex.test(content)) {
  content = content.replace(
    regex,
    "ONNX_ENV.wasm.wasmPaths = chrome.runtime.getURL('assets/wasm/');"
  );
  fs.writeFileSync(filePath, content);
  console.log(
    'Successfully patched dist/offscreen.js to use local WASM paths.'
  );
} else {
  console.warn(
    'Pattern not found in dist/offscreen.js. It might have been already patched or code changed.'
  );
}
