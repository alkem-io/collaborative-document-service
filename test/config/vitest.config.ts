import swc from 'unplugin-swc';
import { defineConfig, coverageConfigDefaults } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    testTimeout: 1_000,
    hookTimeout: 10_000,
    coverage: {
      provider: 'v8', // or 'istanbul'
      reportsDirectory: './coverage',
      // Whether to include all files (even those without tests) in the report.
      // Setting this to `true` surfaces untested files.
      all: true,
      // Whether to clean old coverage output before running new
      clean: true,
      // Glob patterns to *exclude* from coverage (in addition to defaults)
      exclude: [
        // Vitest automatically excludes test files.
        ...coverageConfigDefaults.exclude,
        // Exclude trivial / boilerplate / generated code paths
        'src/config/**',
        'src/**/config/**',
        './*.config.ts',
        './*.config.mjs',
        //
        'src/types/**',
        'src/**/types/**',
        'src/**/*.type.ts',
        //
        'src/**/*.injection.token.ts',
        //
        'src/constants/**',
        'src/**/constants/**',
        //
        'src/generated/**',
        'src/**/*.d.ts',
        //
        'src/index.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        // When true, thresholds apply per-file, not just globally
        perFile: true,
      },
    },
  },
});
