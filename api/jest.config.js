/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  testTimeout: 60000,
  // Run test suites serially to avoid Mongoose singleton connection conflicts
  // between integration test files that each spin up their own MongoMemoryServer.
  maxWorkers: 1
};
