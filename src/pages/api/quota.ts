import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { getRemainingQuota, isProUser } from '@/lib/quota';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const [remaining, pro] = await Promise.all([
      getRemainingQuota(userId),
      isProUser(userId),
    ]);

    return res.status(200).json({
      remaining,
      limit: pro ? null : 3,
      isPro: pro,
    });
  } catch (err: any) {
    console.error('Quota fetch error:', err);
    return res.status(500).json({ error: '获取额度失败', detail: err?.message });
  }
}
