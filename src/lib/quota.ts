import { Redis } from '@upstash/redis';
import { clerkClient } from '@clerk/nextjs/server';

const DAILY_FREE_LIMIT = 3;

let redis: Redis | null = null;
let redisError: string | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || url.includes('https://...') || !token || token.includes('your_')) {
    redisError = 'Redis 未配置，使用内存配额（重启后重置）';
    return null;
  }

  try {
    redis = new Redis({ url, token });
    return redis;
  } catch (err: any) {
    redisError = err?.message || 'Redis 初始化失败';
    console.error('Redis init error:', redisError);
    return null;
  }
}

// 内存配额 fallback：{ userId: { date: usedCount } }
const memoryQuota: Record<string, Record<string, number>> = {};

function getTodayCN(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

export function getQuotaKey(userId: string): string {
  return `quota:${userId}:${getTodayCN()}`;
}

export async function isProUser(userId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.publicMetadata?.plan === 'pro';
  } catch (err) {
    console.error('Failed to fetch Clerk user metadata:', err);
    return false;
  }
}

export async function getRemainingQuota(userId: string): Promise<number> {
  if (await isProUser(userId)) {
    return Infinity;
  }

  const client = getRedis();
  const today = getTodayCN();

  if (!client) {
    const used = memoryQuota[userId]?.[today] || 0;
    return Math.max(DAILY_FREE_LIMIT - used, 0);
  }

  try {
    const used = (await client.get<number>(getQuotaKey(userId))) || 0;
    return Math.max(DAILY_FREE_LIMIT - used, 0);
  } catch (err) {
    console.error('Redis getRemainingQuota error:', err);
    const used = memoryQuota[userId]?.[today] || 0;
    return Math.max(DAILY_FREE_LIMIT - used, 0);
  }
}

export async function incrementQuota(userId: string): Promise<number> {
  const key = getQuotaKey(userId);
  const today = getTodayCN();
  const client = getRedis();

  if (!client) {
    if (!memoryQuota[userId]) memoryQuota[userId] = {};
    memoryQuota[userId][today] = (memoryQuota[userId][today] || 0) + 1;
    return Math.max(DAILY_FREE_LIMIT - memoryQuota[userId][today], 0);
  }

  try {
    const newUsed = await client.incr(key);
    if (newUsed === 1) {
      await client.expire(key, 60 * 60 * 24 * 2);
    }
    return Math.max(DAILY_FREE_LIMIT - newUsed, 0);
  } catch (err) {
    console.error('Redis incrementQuota error:', err);
    if (!memoryQuota[userId]) memoryQuota[userId] = {};
    memoryQuota[userId][today] = (memoryQuota[userId][today] || 0) + 1;
    return Math.max(DAILY_FREE_LIMIT - memoryQuota[userId][today], 0);
  }
}

export function getQuotaBackendStatus(): { ok: boolean; message: string } {
  const client = getRedis();
  if (client) return { ok: true, message: 'redis' };
  return { ok: false, message: redisError || 'Redis 未配置' };
}
