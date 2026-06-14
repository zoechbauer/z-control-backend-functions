// TODO: fix deactivated rules and remove comments
module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'google',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  ignorePatterns: [
    '/lib/**/*',
    '/generated/**/*',
    '.eslintrc.cjs',
    'vitest.config.ts',
    'vitest.learn.config.ts',
    'tools/generate-env.js',
  ],
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    'import/no-unresolved': 0,
    indent: ['error', 2],
    'object-curly-spacing': ['error', 'always'],
    'operator-linebreak': [
      'error',
      'after',
      { overrides: { '?': 'before', ':': 'before' } },
    ],
    'valid-jsdoc': 0,                                // <--  deactivated: JSDoc Error deactivated
    'max-len': 0,                                    // <-- deactivated: Max length error deactivated
    '@typescript-eslint/no-empty-function': 0,       // <-- deactivated: No empty function error deactivated
    '@typescript-eslint/no-explicit-any': 0,         // <-- deactivated: any warnings
    'no-invalid-this': 0,                            // <-- deactivated: 'this' in tests
    'require-jsdoc': 0,                              // <-- deactivated: JSDoc required
    '@typescript-eslint/no-non-null-assertion': 0,   // <-- deactivated: non-null !
    'func-call-spacing': 0,                          // <-- deactivated: function call spacing
    'no-unexpected-multiline': 0,                    // <-- deactivated: unexpected multiline
    '@typescript-eslint/no-unused-vars': 0,          // <-- deactivated: unused variables
  },
};
