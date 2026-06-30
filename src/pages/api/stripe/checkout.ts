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

  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
  if (!priceId) {
    return res.status(500).json({ error: '服务器未配置 STRIPE_PRICE_ID' });
  }

  const origin = req.headers.origin || 'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      client_reference_id: userId,
      metadata: { userId },
    });

    if (!session.url) {
      return res.status(500).json({ error: '未生成支付链接' });
    }

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({
      error: '创建支付失败',
      detail: err?.message || '未知错误',
    });
  }
}
