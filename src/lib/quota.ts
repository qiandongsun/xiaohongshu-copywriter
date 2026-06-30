import { Redis } from '@upstash/redis';
import { clerkClient } from '@clerk/nextjs/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const DAILY_FREE_LIMIT = 3;

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
  const used = (await redis.get<number>(getQuotaKey(userId))) || 0;
  return Math.max(DAILY_FREE_LIMIT - used, 0);
}

export async function incrementQuota(userId: string): Promise<number> {
  const key = getQuotaKey(userId);
  const newUsed = await redis.incr(key);
  if (newUsed === 1) {
    await redis.expire(key, 60 * 60 * 24 * 2);
  }
  return Math.max(DAILY_FREE_LIMIT - newUsed, 0);
}

