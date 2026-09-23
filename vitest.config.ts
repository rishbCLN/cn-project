import { defineConfig } from 'vitest/config';

// Dedicated Vitest config so unit tests run in a hermetic Node environment
// without loading the app's React/Tailwind Vite plugins. When this file is
// present, Vitest uses it instead of vite.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
