const BASE_URL = process.env.ZZZ_API_BASE_URL || 'https://zzztoken.cn/v1';

export interface BuildPromptOptions {
  topic: string;
  category: string;
  style: string;
  contentType: 'title' | 'content' | 'both';
  versions: number;
}

const XIAOHONGSHU_RULES = `整体要求：
1. 语言自然口语化，像真实小红书博主分享
2. 合理使用 emoji，但不要堆砌
3. 正文分段清晰，每段不超过 3 行，段之间空一行
4. 结尾必须带 5-8 个相关的 #话题 标签
5. 避免"震惊""绝绝子"等过度夸张词`;

export function buildPrompt(options: BuildPromptOptions): string {
  const { topic, category, style, contentType, versions } = options;

  if (contentType === 'title') {
    return `你是一位小红书爆款标题专家。请根据以下信息生成 5 个小红书标题：

主题：${topic}
赛道：${category}
风格：${style}

要求：
1. 每个标题 12-25 字，口语化
2. 每个标题必须带至少 1 个 emoji
3. 运用爆款公式：数字法、痛点法、对比法、悬念法
4. 标题要能激发点击欲望
5. 不要出现"震惊""绝绝子"等过度夸张词

直接输出 5 个标题，每行一个，带序号。`;
  }

  const versionInstruction =
    versions > 1
      ? `请生成 ${versions} 个不同版本，用【版本 N】标记每个版本。`
      : '请生成 1 个版本。';

  if (contentType === 'content') {
    return `你是一位小红书文案写手。请根据以下信息写一篇小红书笔记：

主题：${topic}
赛道：${category}
风格：${style}

${versionInstruction}
每个版本包含：标题、正文、标签。

${XIAOHONGSHU_RULES}

输出格式：
【版本 1】
标题：
正文：
标签：

【版本 2】
标题：
正文：
标签：`;
  }

  return `你是一位小红书爆款内容专家。请根据以下信息生成 1 个爆款标题和 1 篇完整小红书笔记：

主题：${topic}
赛道：${category}
风格：${style}

${versionInstruction}
每个版本包含：标题、正文、标签。

${XIAOHONGSHU_RULES}

输出格式：
【版本 1】
标题：
正文：
标签：

【版本 2】
标题：
正文：
标签：`;
}

export function parseVersions(text: string, expectedCount: number): string[] {
  if (!text) return [];

  // 按 【版本 N】拆分
  const markerRegex = /(?:^|\n)\s*【版本\s*\d+】\s*/g;
  const parts = text.split(markerRegex).map((s) => s.trim()).filter(Boolean);

  if (parts.length > 1) {
    return parts;
  }

  // Fallback：尝试按双换行拆分成版本
  const fallbackParts = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (fallbackParts.length >= 2) {
    return fallbackParts.slice(0, expectedCount);
  }

  return [text.trim()];
}

export async function generateContent(
  prompt: string,
  expectedVersions: number
): Promise<{ versions: string[]; raw: string }> {
  if (!process.env.ZZZ_API_KEY) {
    throw new Error('服务器未配置 ZZZ_API_KEY');
  }
  if (!process.env.MODEL_NAME) {
    throw new Error('服务器未配置 MODEL_NAME');
  }

  const modelNames = (process.env.MODEL_NAME || 'gpt-3.5-turbo')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  let lastError = '';
  for (const model of modelNames) {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ZZZ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
        }),
      });

      const responseBody = await response.text();

      if (!response.ok) {
        console.error(
          `Model ${model} failed: HTTP ${response.status} ${response.statusText}`,
          responseBody.slice(0, 500)
        );
        lastError = `HTTP ${response.status}: ${responseBody.slice(0, 200)}`;
        continue;
      }

      const json = JSON.parse(responseBody);
      const text = json.choices?.[0]?.message?.content || '';
      const versions = parseVersions(text, expectedVersions);
      return { versions, raw: text };
    } catch (err: any) {
      console.error(`Model ${model} failed:`, err?.message);
      lastError = err?.message || '未知错误';
    }
  }

  throw new Error(lastError || '所有模型均生成失败');
}
