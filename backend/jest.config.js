/**
 * Jest sobre módulos nativos de ECMAScript ("type": "module").
 *
 * ts-jest transpila los .ts a ESM y `moduleNameMapper` quita la extensión
 * `.js` de los imports relativos (exigida por `module: nodenext`) para que
 * el resolvedor de Jest encuentre el archivo .ts original.
 *
 * Cobertura: se mide sólo la lógica con comportamiento propio. Quedan fuera
 * el arranque (`index.ts`), el ensamblado (`app.ts`, rutas, contenedor), la
 * conexión y el schema de Mongoose, y la especificación OpenAPI: son cableado
 * o configuración declarativa, y los ejercitan las pruebas de integración y
 * de estrés, no las unitarias.
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
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts',
    '!src/app.ts',
    '!src/config/**',
    '!src/routes/**',
    '!src/docs/**',
    '!src/infrastructure/persistence/mongoose/connection.ts',
    '!src/infrastructure/persistence/mongoose/empleado.schema.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov'],
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};
