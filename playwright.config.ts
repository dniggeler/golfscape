import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173/golfscape/', hasTouch: true },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173/golfscape/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'iphone-se', use: { viewport: { width: 375, height: 667 }, isMobile: true } },
    { name: 'iphone-14', use: { viewport: { width: 390, height: 844 }, isMobile: true } },
  ],
})
