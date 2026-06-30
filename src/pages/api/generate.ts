import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { getAuth } from '@clerk/nextjs/server';
import { getRemainingQuota, incrementQuota } from '@/lib/quota';

const client = new OpenAI({
  apiKey: process.env.ZZZ_API_KEY,
  baseURL: 'https://zzztoken.cn/v1',
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
    return res.status(401).json({ error: '请先登录后再生成文案' });
  }

  const { topic, category, style, contentType } = req.body;

  if (!topic || !category || !style || !contentType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!process.env.ZZZ_API_KEY) {
    return res.status(500).json({ error: '服务器未配置 ZZZ_API_KEY' });
  }

  if (!process.env.MODEL_NAME) {
    return res.status(500).json({ error: '服务器未配置 MODEL_NAME' });
  }

  try {
    const remaining = await getRemainingQuota(userId);
    if (remaining <= 0) {
      return res.status(429).json({
        error: '今日免费额度已用完，升级会员可无限生成',
        limitReached: true,
      });
    }

    let prompt = '';

    if (contentType === 'title') {
      prompt = `你是一位小红书爆款标题专家。请根据以下信息生成 5 个小红书标题：

主题：${topic}
赛道：${category}
风格：${style}

要求：
1. 每个标题 12-25 字，口语化
2. 必须使用至少 1 个 emoji
3. 运用爆款公式：数字法、痛点法、对比法、悬念法
4. 标题要能激发点击欲望
5. 不要出现"震惊""绝绝子"等过度夸张词

直接输出 5 个标题，每行一个，带序号。`;
    } else if (contentType === 'content') {
      prompt = `你是一位小红书文案写手。请根据以下信息写一篇小红书笔记：

主题：${topic}
赛道：${category}
风格：${style}

要求：
1. 字数 300-600 字
2. 开头 3 行必须抓人眼球
3. 正文分段清晰，每段不超过 3 行
4. 加入个人体验感，像真实博主分享
5. 结尾引导评论或收藏
6. 带 5-8 个相关 #话题标签

输出格式：
标题：
正文：
标签：`;
    } else {
      prompt = `你是一位小红书爆款内容专家。请根据以下信息生成 1 个爆款标题和 1 篇完整小红书笔记：

主题：${topic}
赛道：${category}
风格：${style}

要求：
1. 标题 12-25 字，口语化，带 emoji
2. 正文 300-600 字，开头抓人，分段清晰
3. 结尾引导互动
4. 带 5-8 个相关 #话题标签

输出格式：
标题：
正文：
标签：`;
    }

    const modelNames = (process.env.MODEL_NAME || 'gpt-3.5-turbo')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    let lastError = '';
    for (const model of modelNames) {
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        });
        const text = response.choices[0]?.message?.content || '';
        const newRemaining = await incrementQuota(userId);
        return res.status(200).json({ result: text, remaining: newRemaining });
      } catch (err: any) {
        console.error(`Model ${model} failed:`, err?.message);
        lastError = err?.message || '未知错误';
      }
    }

    res.status(500).json({ error: '生成失败', detail: lastError });
  } catch (error: any) {
    console.error('Generation error:', error);
    const message = error?.message || '未知错误';
    res.status(500).json({ error: '生成失败', detail: message });
  }
}
