const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// The public firebase/* entry is the browser build. On a phone it crashes
// while opening because it expects a browser. Use the React Native builds.
const nativeFirebase = {
  'firebase/auth': path.join(__dirname, 'node_modules/@firebase/auth/dist/rn/index.js'),
  'firebase/firestore': path.join(__dirname, 'node_modules/@firebase/firestore/dist/index.rn.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== 'web' && nativeFirebase[moduleName]) {
    return { type: 'sourceFile', filePath: nativeFirebase[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
