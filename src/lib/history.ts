import { Redis } from '@upstash/redis';
import { getRedis } from './quota';

const HISTORY_LIMIT = 50;
const HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface HistoryItem {
  id: string;
  topic: string;
  category: string;
  style: string;
  contentType: string;
  result: string;
  versions: string[];
  favorite: boolean;
  createdAt: number;
}

// 内存历史 fallback：{ userId: HistoryItem[] }
const memoryHistory: Map<string, HistoryItem[]> = new Map();

function getHistoryKey(userId: string): string {
  return `history:${userId}`;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveHistory(
  userId: string,
  data: Omit<HistoryItem, 'id' | 'favorite' | 'createdAt'>
): Promise<HistoryItem> {
  const item: HistoryItem = {
    ...data,
    id: generateId(),
    favorite: false,
    createdAt: Date.now(),
  };

  const client = getRedis();
  if (client) {
    try {
      const key = getHistoryKey(userId);
      await client.zadd(key, { score: item.createdAt, member: JSON.stringify(item) });
      await client.expire(key, HISTORY_TTL_SECONDS);
      // 只保留最新 50 条
      const count = await client.zcard(key);
      if (count > HISTORY_LIMIT) {
        await client.zremrangebyrank(key, 0, count - HISTORY_LIMIT - 1);
      }
    } catch (err) {
      console.error('Redis saveHistory error:', err);
      fallbackToMemory(userId, item);
    }
  } else {
    fallbackToMemory(userId, item);
  }

  return item;
}

function fallbackToMemory(userId: string, item: HistoryItem) {
  const list = memoryHistory.get(userId) || [];
  list.unshift(item);
  if (list.length > HISTORY_LIMIT) {
    list.length = HISTORY_LIMIT;
  }
  memoryHistory.set(userId, list);
}

export async function getHistory(userId: string): Promise<HistoryItem[]> {
  const client = getRedis();
  if (client) {
    try {
      const key = getHistoryKey(userId);
      const members = await client.zrange<HistoryItem[]>(key, 0, HISTORY_LIMIT - 1, {
        rev: true,
      });
      return members.map((m) => (typeof m === 'string' ? JSON.parse(m) : m));
    } catch (err) {
      console.error('Redis getHistory error:', err);
      return memoryHistory.get(userId) || [];
    }
  }
  return memoryHistory.get(userId) || [];
}

export async function updateHistory(
  userId: string,
  id: string,
  updates: Partial<Pick<HistoryItem, 'favorite' | 'result'>>
): Promise<HistoryItem | null> {
  const client = getRedis();
  const key = getHistoryKey(userId);

  if (client) {
    try {
      const members = await client.zrange<string[]>(key, 0, -1);
      for (const member of members) {
        const item: HistoryItem = JSON.parse(member);
        if (item.id === id) {
          const updated = { ...item, ...updates };
          await client.zrem(key, member);
          await client.zadd(key, { score: updated.createdAt, member: JSON.stringify(updated) });
          await client.expire(key, HISTORY_TTL_SECONDS);
          return updated;
        }
      }
      return null;
    } catch (err) {
      console.error('Redis updateHistory error:', err);
      return updateMemoryHistory(userId, id, updates);
    }
  }
  return updateMemoryHistory(userId, id, updates);
}

function updateMemoryHistory(
  userId: string,
  id: string,
  updates: Partial<Pick<HistoryItem, 'favorite' | 'result'>>
): HistoryItem | null {
  const list = memoryHistory.get(userId) || [];
  const idx = list.findIndex((item) => item.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updates };
  return list[idx];
}

export async function deleteHistory(userId: string, id: string): Promise<boolean> {
  const client = getRedis();
  const key = getHistoryKey(userId);

  if (client) {
    try {
      const members = await client.zrange<string[]>(key, 0, -1);
      for (const member of members) {
        const item: HistoryItem = JSON.parse(member);
        if (item.id === id) {
          await client.zrem(key, member);
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('Redis deleteHistory error:', err);
      return deleteMemoryHistory(userId, id);
    }
  }
  return deleteMemoryHistory(userId, id);
}

function deleteMemoryHistory(userId: string, id: string): boolean {
  const list = memoryHistory.get(userId) || [];
  const idx = list.findIndex((item) => item.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

export async function getHistoryItem(userId: string, id: string): Promise<HistoryItem | null> {
  const history = await getHistory(userId);
  return history.find((item) => item.id === id) || null;
}
