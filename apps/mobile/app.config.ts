import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Qulene',
  slug: process.env.EXPO_PROJECT_SLUG ?? 'qulene',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  scheme: 'qulene',
  extra: {
    eas: {
      projectId: process.env.EXPO_PROJECT_ID,
    },
  },
  owner: process.env.EXPO_PROJECT_OWNER,
});
