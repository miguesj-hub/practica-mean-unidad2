/**
 * Jest sobre módulos nativos de ECMAScript ("type": "module").
 *
 * ts-jest transpila los .ts a ESM y `moduleNameMapper` quita la extensión
 * `.js` de los imports relativos (exigida por `module: nodenext`) para que
 * el resolvedor de Jest encuentre el archivo .ts original.
 */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  verbose: true,
  clearMocks: true,
  testMatch: ['**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
