import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],

  setupFiles: ['<rootDir>/tests/helpers/env.ts'],
  globalSetup: '<rootDir>/tests/helpers/setup.ts',

  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: false,
  maxWorkers: 1,

  // Utilise le tsconfig dédié aux tests
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};

export default config;