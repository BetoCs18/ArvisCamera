import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dticonsultores.arvistrainer',
  appName: 'ArvisCamera',
  webDir: 'www',
  plugins: {
    "FFmpegStream": {
      "ios": {
        "class": "FFmpegStreamPlugin"
      },
      "android": {
        "class": "FFmpegStreamPlugin"
      }
    }
  }
};

export default config;
