import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { getHistory, updateHistory, deleteHistory } from '@/lib/history';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  if (req.method === 'GET') {
    try {
      const history = await getHistory(userId);
      return res.status(200).json({ history });
    } catch (err: any) {
      console.error('History fetch error:', err);
      return res.status(500).json({ error: '获取历史失败', detail: err?.message });
    }
  }

  if (req.method === 'PATCH') {
    const { id, favorite, result } = req.body;
    if (!id) {
      return res.status(400).json({ error: '缺少 id' });
    }
    const updates: Partial<{ favorite: boolean; result: string }> = {};
    if (typeof favorite === 'boolean') updates.favorite = favorite;
    if (typeof result === 'string') updates.result = result;

    try {
      const updated = await updateHistory(userId, id, updates);
      if (!updated) {
        return res.status(404).json({ error: '历史记录不存在' });
      }
      return res.status(200).json({ historyItem: updated });
    } catch (err: any) {
      console.error('History update error:', err);
      return res.status(500).json({ error: '更新历史失败', detail: err?.message });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: '缺少 id' });
    }
    try {
      const ok = await deleteHistory(userId, id);
      if (!ok) {
        return res.status(404).json({ error: '历史记录不存在' });
      }
      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error('History delete error:', err);
      return res.status(500).json({ error: '删除历史失败', detail: err?.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
