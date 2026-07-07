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
    '/coverage/**/*',
    'coverage/**/*',
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
    'max-len': [
      'error',
      {
        code: 100,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.spec.ts', '**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-invalid-this': 'off',
        'no-invalid-this': 'off',
      },
    },
  ],
};
