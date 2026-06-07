const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const REPO_ROOT = path.resolve(__dirname, '../..');

const config = getDefaultConfig(__dirname);

// In a monorepo npm can hoist duplicate React versions into workspace-level
// node_modules when versions differ across packages. Force Metro to always
// resolve react and react-native from the root so there is exactly one copy
// of each in the bundle — multiple copies cause "Invalid hook call" errors.
config.resolver.extraNodeModules = {
  'react': path.resolve(REPO_ROOT, 'node_modules/react'),
  'react-native': path.resolve(REPO_ROOT, 'node_modules/react-native'),
};

// NativeWind bundles its own react-native@0.85.3 internally. Metro would
// otherwise try to run @react-native/babel-plugin-codegen on those files using
// the project's RN 0.81.5 codegen, which can't parse the newer file format.
// Block the nested copy entirely so Metro always resolves react-native from
// the project root.
const nativewindRN = path.resolve(
  REPO_ROOT,
  'node_modules/nativewind/node_modules/react-native'
);
config.resolver.blockList = [
  ...(config.resolver.blockList ? [config.resolver.blockList].flat() : []),
  new RegExp(`^${nativewindRN.replace(/[/\\]/g, '[/\\\\]')}/.*`),
];

module.exports = withNativeWind(config, { input: './global.css' });
