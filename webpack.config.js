const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    popup: './src/popup/popup.js',
    options: './src/options/options.js',
    offscreen: './src/offscreen/offscreen.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  mode: 'production',
  optimization: {
    minimize: true,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'src/popup/popup.html', to: 'popup.html' },
        { from: 'src/options/options.html', to: 'options.html' },
        { from: 'src/offscreen/offscreen.html', to: 'offscreen.html' },
        { from: 'src/assets', to: 'assets', noErrorOnMissing: true },
        {
          from: 'node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm',
          to: 'assets/wasm/[name][ext]',
        },
      ],
    }),
  ],
};
