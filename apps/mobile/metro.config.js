const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const MOBILE_ROOT = __dirname;
const REPO_ROOT = path.resolve(MOBILE_ROOT, '../..');

const config = getDefaultConfig(MOBILE_ROOT);

// Watch the full monorepo so Metro can resolve workspace packages
// (e.g. @qulene/api-types in packages/).
config.watchFolders = [REPO_ROOT];

// nodeModulesPaths adds fallback lookup paths after directory climbing.
config.resolver.nodeModulesPaths = [
  path.resolve(MOBILE_ROOT, 'node_modules'),
  path.resolve(REPO_ROOT, 'node_modules'),
];

// Block NativeWind's bundled react-native@0.85.3 so Metro always resolves
// react-native from the project, not NativeWind's internal subtree.
const nativewindRN = path.resolve(
  REPO_ROOT,
  'node_modules/nativewind/node_modules/react-native'
);
config.resolver.blockList = [
  ...(config.resolver.blockList ? [config.resolver.blockList].flat() : []),
  new RegExp(`^${nativewindRN.replace(/[/\\]/g, '[/\\\\]')}/.*`),
];

// Hard-wire all 'react' requires to apps/mobile/node_modules/react@19.1.0.
//
// WHY resolveRequest, not extraNodeModules:
//   Metro's allDirPaths.concat(extraPaths) appends extraNodeModules AFTER directory
//   climbing. Root packages (aws-amplify, expo-router) find root/node_modules/react@19.2.7
//   via the climb before extraNodeModules is reached — two copies → "Invalid hook call".
//   resolveRequest fires before any path search: a true global override.
//
// WHY set BEFORE withNativeWind:
//   withCssInterop (called by withNativeWind) reads config.resolver.resolveRequest as
//   `originalResolver` at the moment withNativeWind runs, then wraps it with its own
//   CSS-interop resolver. Setting resolveRequest AFTER withNativeWind overwrites that
//   wrapper, breaking CSS processing → unstyled output.
//   Setting it here gives the chain: Metro → NativeWind CSS interop → react override → Metro default.
//
// WHY 19.1.0:
//   react-native@0.81.5 bundles react-native-renderer@19.1.0. Versions must be identical.
const mobileReactDir = path.resolve(MOBILE_ROOT, 'node_modules/react');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react') {
    return { filePath: path.join(mobileReactDir, 'index.js'), type: 'sourceFile' };
  }
  if (moduleName === 'react/jsx-runtime') {
    return { filePath: path.join(mobileReactDir, 'jsx-runtime.js'), type: 'sourceFile' };
  }
  if (moduleName === 'react/jsx-dev-runtime') {
    return { filePath: path.join(mobileReactDir, 'jsx-dev-runtime.js'), type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Apply NativeWind AFTER setting resolveRequest so withCssInterop captures the react
// override as its `originalResolver` and chains it correctly (CSS interop → react fix → Metro default).
module.exports = withNativeWind(config, { input: './global.css' });
