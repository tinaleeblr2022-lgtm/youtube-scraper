#!/bin/bash

# AI获客工具快速启动脚本

echo "🚀 启动 AI获客工具..."
echo ""

# 进入后端目录
cd "$(dirname "$0")/backend"

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    npm install
fi

# 启动后端服务
echo "🔧 启动后端服务..."
echo "后端地址: http://localhost:3001"
echo ""

# 检查是否已安装 nodemon
if command -v nodemon &> /dev/null; then
    npm run dev
else
    npm start
fi
