module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/backend/', '/webapp/'],
  moduleNameMapper: {
    '^@env$': '<rootDir>/src/test-utils/env-stub.ts',
  },
};
