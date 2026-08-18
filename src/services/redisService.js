const redis = require('redis');
const config = require('../config');

class RedisService {
  constructor() {
    this.client = null;
    this.enabled = process.env.REDIS_URL ? true : false;
  }

  async connect() {
    if (!this.enabled || this.client) return null;

    try {
      this.client = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
      this.client.on('error', (error) => {
        // Suppress repeated connection logs when Redis is offline
        if (this.client) {
          this.client.disconnect().catch(() => {});
          this.client = null;
        }
      });
      await this.client.connect();
      console.log('Redis connected successfully.');
      return this.client;
    } catch (error) {
      console.log('Redis offline - operating with in-memory cache fallback.');
      this.client = null;
      return null;
    }
  }

  async get(key) {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key, value, ttlSeconds = 300) {
    if (!this.client) return null;
    return this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  }

  async del(key) {
    if (!this.client) return null;
    return this.client.del(key);
  }

  async increment(key, amount = 1) {
    if (!this.client) return 0;
    return this.client.incrBy(key, amount);
  }
}

module.exports = new RedisService();
