import { defineConfig } from '@playwright/test';

/**
 * Les tests tournent contre le front en developpement (port 5180), branche
 * sur un Worker local (port 8787) : voir tests/README.md. Vue mobile par
 * defaut, l'app est mobile-first.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './global-setup.js',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // `wrangler dev` traite les requetes une a une : au-dela de 3 navigateurs
  // en parallele, les reponses tardent et les tests expirent.
  workers: 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.DONEO_URL || 'http://localhost:5180',
    browserName: 'chromium',
    viewport: { width: 375, height: 812 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5180 --strictPort',
    cwd: '../public',
    url: 'http://localhost:5180',
    reuseExistingServer: true,
    env: { VITE_API_BASE: process.env.DONEO_API || 'http://localhost:8787' },
  },
});
