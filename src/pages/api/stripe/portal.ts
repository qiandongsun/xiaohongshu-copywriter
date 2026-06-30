import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  typescript: true,
});

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

  const origin = req.headers.origin || 'http://localhost:3000';

  try {
    const client = await (await import('@clerk/nextjs/server')).clerkClient();
    const user = await client.users.getUser(userId);
    const customerId = user.publicMetadata?.stripeCustomerId as string | undefined;

    if (!customerId) {
      return res.status(400).json({ error: '未找到订阅记录' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (err: any) {
    console.error('Stripe portal error:', err);
    return res.status(500).json({
      error: '打开订阅管理失败',
      detail: err?.message || '未知错误',
    });
  }
}
