import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 90000,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/e2e/setup.ts'],
    // E2E tests spin real infra/queues; run serially to avoid cross-test races.
    fileParallelism: false,
  },
});
