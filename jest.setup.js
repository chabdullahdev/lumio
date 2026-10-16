/* eslint-env jest */
/**
 * Jest setup shared by all tests.
 *
 * Mocks native modules that do not exist in the Jest (Node) environment, with
 * the same async interface the app uses at runtime.
 */
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();

  const AsyncStorage = {
    getItem: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
    setItem: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async key => {
      store.delete(key);
    }),
    clear: jest.fn(async () => {
      store.clear();
    }),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
    multiGet: jest.fn(async keys => keys.map(key => [key, store.get(key) ?? null])),
    multiSet: jest.fn(async pairs => {
      for (const [key, value] of pairs) {
        store.set(key, value);
      }
    }),
    multiRemove: jest.fn(async keys => {
      for (const key of keys) {
        store.delete(key);
      }
    }),
  };

  return { __esModule: true, default: AsyncStorage };
});
