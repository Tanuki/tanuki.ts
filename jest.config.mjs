export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.spec.ts', '**/tests/*.spec.ts', '**/tests/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'babel-jest'
  },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [
    "node_modules/(?!(axios)/)" // add other packages here if needed
  ],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/types/**/*.ts',
  ],
  globals: {
    'ts-jest': {
      diagnostics: false,
      isolatedModules: true,
      useESM: true,
    },
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
