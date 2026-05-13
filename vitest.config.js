import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['**/.wanman/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      reporter: ['text', 'lcov', 'clover'],
      reportsDirectory: 'coverage',
      thresholds: {
        statements: 95,
        branches: 85,
        functions: 90,
        lines: 95,
      },
    },
  },
});
