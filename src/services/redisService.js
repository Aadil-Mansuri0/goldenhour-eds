const redis = require('redis');

class RedisService {
  constructor() {
    this.client = null;
    this.enabled = Boolean(process.env.REDIS_URL);
  }

  async connect() {
    if (!this.enabled || this.client) return null;

    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: { reconnectStrategy: false }
      });
      this.client.on('error', (_error) => {
        // Suppress repeated connection logs when Redis is offline
        this.client = null;
      });
      await this.client.connect();
      console.log('Redis connected successfully.');
      return this.client;
    } catch (_error) {
      console.log('Redis offline - operating with in-memory cache fallback.');
      this.client = null;
      return null;
    }
  }

  async get(key) {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch (_err) {
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    if (!this.client) return null;
    try {
      return await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (_err) {
      return null;
    }
  }

  async del(key) {
    if (!this.client) return null;
    try {
      return await this.client.del(key);
    } catch (_err) {
      return null;
    }
  }

  async increment(key, amount = 1) {
    if (!this.client) return 0;
    try {
      return await this.client.incrBy(key, amount);
    } catch (_err) {
      return 0;
    }
  }
}

module.exports = new RedisService();
