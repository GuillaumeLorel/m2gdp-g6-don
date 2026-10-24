import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// L'application vit dans /public pour respecter la convention du cours
// (/public = App Frontend). Deux consequences :
//  - publicDir est renomme en 'static', sinon Vite chercherait public/public
//  - le build sort dans public/dist, que Vercel met en ligne
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: 'static',
  // En developpement, le serveur relaie /api vers le Worker lance par
  // `wrangler dev`. Utile pour tester sur un telephone : il n'a alors besoin
  // de joindre que ce serveur (voir docs/SETUP.md). Sans effet tant que
  // VITE_API_BASE ne vise pas ce serveur lui-meme.
  server: {
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
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
