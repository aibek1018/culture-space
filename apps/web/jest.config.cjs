/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          strict: true,
          module: 'commonjs',
          moduleResolution: 'node',
          resolveJsonModule: true,
          isolatedModules: true,
          types: ['jest', 'node', '@testing-library/jest-dom'],
        },
      },
    ],
  },
};
