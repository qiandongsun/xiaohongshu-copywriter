#!/bin/bash
# 启动开发服务器（清理来自其他项目的环境污染变量）
cd "$(dirname "$0")"

# 清理会干扰 Next.js 的环境变量
unset __NEXT_PRIVATE_STANDALONE_CONFIG
unset __NEXT_PRIVATE_ORIGIN
unset NEXT_DEPLOYMENT_ID
unset TURBOPACK
unset NODE_ENV

# 使用 Node 22（如果已安装）
if [ -x "$HOME/.n/bin/node" ]; then
  export PATH="$HOME/.n/bin:$PATH"
fi

exec npx next dev -p 3000 "$@"
