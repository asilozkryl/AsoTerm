import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    // electron-updater paketlenmiş uygulamada gerekli; proje node_modules
    // göndermediği için externalize ETME → main bundle'ına dahil edilsin.
    plugins: [externalizeDepsPlugin({ exclude: ['electron-updater'] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react()],
    // Monaco worker'ları büyük; uyarıyı bastır.
    build: {
      chunkSizeWarningLimit: 4096,
    },
  },
});
