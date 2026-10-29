import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Контейнер Postgres поднимается один раз на файл тестов.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
