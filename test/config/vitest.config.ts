import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite()],
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, '../../src'),
      '@test': path.resolve(__dirname, '../../test'),
      '@common': path.resolve(__dirname, '../../src/common'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8', // or 'istanbul'
      reportsDirectory: './coverage',
    },
  },
});
