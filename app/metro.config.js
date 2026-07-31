// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase's ESM builds use import.meta, which Metro doesn't transform.
// Fall back to main-field (CJS) resolution so Firebase bundles correctly.
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
