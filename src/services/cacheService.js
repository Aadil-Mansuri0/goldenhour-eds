class CacheService {
  constructor(ttlMs = 30000) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  del(key) {
    this.store.delete(key);
  }
}

module.exports = new CacheService();
