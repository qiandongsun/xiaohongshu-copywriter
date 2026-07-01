import { readFileSync } from 'fs';
import { Redis } from '@upstash/redis';
import { resolve } from 'path';

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore
  }
}

loadEnvLocal();

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || url.includes('https://...') || !token || token.includes('your_')) {
  console.error('❌ Redis 未配置：请在 .env.local 中填入真实的 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN');
  process.exit(1);
}

const redis = new Redis({ url, token });

async function main() {
  try {
    const ping = await redis.ping();
    console.log('✅ 连接成功，ping:', ping);

    const testKey = `test:${Date.now()}`;
    await redis.set(testKey, 'hello from xiaohongshu-generator');
    const value = await redis.get(testKey);
    await redis.del(testKey);

    console.log('✅ 读写测试通过:', value);
  } catch (err) {
    console.error('❌ Redis 连接失败:', err?.message || err);
    process.exit(1);
  }
}

main();
