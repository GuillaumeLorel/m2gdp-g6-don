import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// L'application vit dans /public pour respecter la convention du cours
// (/public = App Frontend). Deux consequences :
//  - publicDir est renomme en 'static', sinon Vite chercherait public/public
//  - le build sort dans public/dist, qui est la cible Firebase Hosting « app »
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: 'static',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
