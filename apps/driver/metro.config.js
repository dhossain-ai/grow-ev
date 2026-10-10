const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Shared client/server contracts live outside the Expo project root.
config.watchFolders = [path.resolve(__dirname, '../../packages')];
module.exports = config;
