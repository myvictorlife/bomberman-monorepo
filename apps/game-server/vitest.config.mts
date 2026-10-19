import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The server runs on Node, so its specs do too — not through the Angular
 * unit-test builder the browser libraries use. Workspace aliases come from
 * `tsconfig.base.json`.
 */
export default defineConfig({
  root,
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/game-server/src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['apps/game-server/src/**/*.ts'],
      exclude: ['apps/game-server/src/**/*.spec.ts', 'apps/game-server/src/main.ts'],
      thresholds: { statements: 90, branches: 80, functions: 90, lines: 90 },
    },
  },
});
