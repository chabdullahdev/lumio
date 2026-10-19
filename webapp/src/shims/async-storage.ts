/** Browser stand-in for the phone's AsyncStorage (same async API, backed by localStorage). */
const memory = new Map<string, string>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // private mode or blocked storage: fall back to memory
  }
}

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return storage()?.getItem(key) ?? memory.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    memory.set(key, value);
    try {
      storage()?.setItem(key, value);
    } catch {
      // keep the in-memory copy
    }
  },
  async removeItem(key: string): Promise<void> {
    memory.delete(key);
    try {
      storage()?.removeItem(key);
    } catch {
      // nothing to do
    }
  },
};

export default AsyncStorage;
