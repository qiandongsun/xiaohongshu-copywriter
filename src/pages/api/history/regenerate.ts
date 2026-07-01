import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { getRemainingQuota, incrementQuota } from '@/lib/quota';
import { buildPrompt, generateContent } from '@/lib/generate';
import { getHistoryItem, saveHistory } from '@/lib/history';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: '请先登录' });
  }

  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: '缺少 id' });
  }

  try {
    const item = await getHistoryItem(userId, id);
    if (!item) {
      return res.status(404).json({ error: '历史记录不存在' });
    }

    const remaining = await getRemainingQuota(userId);
    if (remaining <= 0) {
      return res.status(429).json({
        error: '今日免费额度已用完，升级会员可无限生成',
        limitReached: true,
      });
    }

    const contentTypeValue: 'title' | 'content' | 'both' =
      item.contentType === 'title' ||
      item.contentType === 'content' ||
      item.contentType === 'both'
        ? item.contentType
        : 'both';

    const versions = Math.min(item.versions.length || 3, 5);

    const prompt = buildPrompt({
      topic: item.topic,
      category: item.category,
      style: item.style,
      contentType: contentTypeValue,
      versions,
    });

    const { versions: results } = await generateContent(prompt, versions);
    const result = results[0] || '';

    const newRemaining = await incrementQuota(userId);

    const historyItem = await saveHistory(userId, {
      topic: item.topic,
      category: item.category,
      style: item.style,
      contentType: contentTypeValue,
      result,
      versions: results,
    });

    return res.status(200).json({
      result,
      versions: results,
      remaining: newRemaining,
      historyItem,
    });
  } catch (error: any) {
    console.error('Regenerate error:', error);
    const message = error?.message || '未知错误';
    res.status(500).json({ error: '生成失败', detail: message });
  }
}
