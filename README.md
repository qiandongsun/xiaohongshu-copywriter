# 小红书爆款文案生成器

一个基于 Next.js + 第三方 OpenAI 兼容 API 的小红书标题/文案生成工具。

## 功能

- 输入主题，选择赛道、风格、内容类型
- 生成爆款标题、正文或标题+正文
- 一键复制生成结果
- 响应式设计，手机和电脑都能用

## 技术栈

- Next.js 14
- React + TypeScript
- 第三方 OpenAI 兼容 API（默认配置 zzztoken.cn）
- Vercel 部署

## 本地运行

### 1. 安装依赖

```bash
cd xiaohongshu-generator
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的 API Key 和模型名：

```
ZZZ_API_KEY=sk-...
MODEL_NAME=moonshot-v1-8k
```

如果使用的不是 `zzztoken.cn`，还可以自定义 API 地址：

```
ZZZ_API_BASE_URL=https://你的-api-地址/v1
```

模型名可以根据你的 API 供应商支持情况调整，常见可选项：
- `moonshot-v1-8k`
- `gpt-4o-mini`
- `gpt-4o`
- `claude-3-5-sonnet`
- `deepseek-chat`

如果不知道支持哪些模型，可以访问 `https://zzztoken.cn/v1/models` 查询。

### 3. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 即可使用。

## 部署到 Vercel

1. 把项目推送到 GitHub
2. 登录 [Vercel](https://vercel.com)
3. 点击 "Add New Project"，导入 GitHub 仓库
4. 在 Environment Variables 中添加 `ZZZ_API_KEY`
5. 点击 Deploy

部署完成后，你就拥有了一个可访问的在线工具。

## 后续变现建议

1. 添加用户系统（Clerk/NextAuth）
2. 添加免费次数限制和会员付费（Lemon Squeezy / Stripe）
3. 做小红书/抖音引流内容
4. 优化 SEO，获取自然流量

## 注意事项

- API Key 不要暴露在前端代码中，已通过 Next.js API Route 保护
- 第三方 API 的模型名可能需要根据供应商文档调整
