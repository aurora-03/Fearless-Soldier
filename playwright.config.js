import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  workers: 1,
  reporter: 'list',
  outputDir: 'artifacts/browser',
  use: { baseURL: 'http://127.0.0.1:5174', viewport: { width: 1360, height: 1050 }, headless: true },
  webServer: { command: 'npm start', env: { PORT: '5174' }, url: 'http://127.0.0.1:5174', reuseExistingServer: false },
});
