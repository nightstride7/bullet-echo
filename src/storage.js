// Tiny localStorage wrapper that mimics the async get/set API the app uses.
export const storage = {
  async get(key) {
    try { const v = localStorage.getItem(key); return v == null ? null : { key, value: v }; }
    catch { return null; }
  },
  async set(key, value) {
    try { localStorage.setItem(key, value); return { key, value }; }
    catch { return null; }
  },
};
