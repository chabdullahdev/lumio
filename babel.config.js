const isTest = process.env.NODE_ENV === 'test' || process.env.BABEL_ENV === 'test';

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // In tests, `@env` is provided by jest.config.js moduleNameMapper instead,
    // so tests are deterministic regardless of a local `.env` file.
    ...(isTest
      ? []
      : [
          [
            'module:react-native-dotenv',
            {
              moduleName: '@env',
              path: '.env',
              allowUndefined: true,
            },
          ],
        ]),
  ],
};
