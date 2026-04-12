import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import manifest from './manifest.config';

function formatBuildTime(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(',', '');
}

const buildTime = formatBuildTime(new Date());

export default defineConfig({
  define: {
    __CHATBROWSERX_BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        offscreen: 'src/background/speech/offscreen.html',
        'audio-processor': 'src/background/speech/audio-processor.js',
      },
    },
  },
});
