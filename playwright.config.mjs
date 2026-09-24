import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:8765' },
  webServer: {
    command: 'python3 -m http.server 8765',
    port: 8765,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
