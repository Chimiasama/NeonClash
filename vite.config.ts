import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      // Copies unbundled static game folders into dist/ so relative URLs
      // (./css, ./js, ./cards, ./avatars, ./audio) resolve cleanly in builds
      // and Android Studio WebView exports.
      {
        name: 'copy-unbundled-game-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const folders = ['src/assets', 'css', 'js', 'cards', 'avatars', 'audio'];
          for (const folder of folders) {
            const srcPath = path.resolve(__dirname, folder);
            const destPath = path.resolve(distDir, folder);
            if (fs.existsSync(distDir) && fs.existsSync(srcPath)) {
              fs.cpSync(srcPath, destPath, {recursive: true, force: true});
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
