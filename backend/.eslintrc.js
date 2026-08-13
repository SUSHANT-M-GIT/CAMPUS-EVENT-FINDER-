module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  ignorePatterns: ['node_modules/', 'uploads/', 'dist/'],
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'prettier/prettier': ['error', { endOfLine: 'auto' }],
  },
};
