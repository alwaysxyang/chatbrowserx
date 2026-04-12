import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'ChatBrowserX',
  version: '0.1.0',
  icons: {
    16: 'src/assets/icon-16.png',
    32: 'src/assets/icon-32.png',
    48: 'src/assets/icon-48.png',
    128: 'src/assets/icon-128.png',
  },
  permissions: ['storage', 'unlimitedStorage', 'activeTab', 'tabCapture', 'offscreen'],
  host_permissions: ['<all_urls>'],
  action: {
    default_icon: {
      16: 'src/assets/icon-16.png',
      32: 'src/assets/icon-32.png',
      48: 'src/assets/icon-48.png',
    },
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/ui/content/index.tsx'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: [
        'src/background/speech/offscreen.html',
        'src/background/speech/audio-processor.js',
      ],
      matches: ['<all_urls>'],
    },
  ],
});
