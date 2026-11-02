import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  globalIgnores([
    '.next/**',
    'coverage/**',
    'next-env.d.ts',
    'jest.config.cjs',
    'jest.setup.cjs',
  ]),
]);
