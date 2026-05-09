# AI获客工具 - YouTube抓取 + 邮件营销自动化

一个功能完整的客户获取和营销自动化工具，集成YouTube频道抓取和批量邮件发送功能。

## 功能特性

✨ **核心功能**

### YouTube频道抓取
- 多关键词并行抓取（支持逗号或换行分隔）
- 精准频道匹配（无API限制）
- 自动提取多种联系方式（邮箱、Instagram、Telegram、Discord等）
- Excel导出功能
- 实时进度显示

### 邮件营销自动化 🆕
- 上传Excel客户列表自动发送邮件
- 支持自定义邮件模板（可保存多个模板）
- 邮件内容支持变量替换（{客户名称}）
- 可控制发送间隔，避免被判定为垃圾邮件
- 实时显示发送进度和结果
- 失败邮件支持重试发送
- 兼容主流邮箱（QQ、163、Gmail、企业邮箱）

🛡️ **反爬优化**
- 模拟真实浏览器访问
- 可调节抓取间隔
- Puppeteer无头浏览器技术
- 自动翻页加载更多结果

## 技术栈

**后端**
- Node.js + Express.js
- Puppeteer（无头浏览器抓取）
- Cheerio（HTML解析）
- Axios（HTTP请求）
- Nodemailer（邮件发送）
- Multer（文件上传）
- XLSX（Excel处理）

**前端**
- 原生HTML/CSS/JavaScript
- SheetJS（Excel导出）
- Axios（API通信）
- 标签页切换界面

## 快速开始

### 1. 环境要求

- Node.js 16+ 版本
- npm 包管理器

### 2. 安装依赖

**后端安装：**
```bash
cd backend
npm install
```

**前端安装：**
```bash
cd frontend
npm install
```

### 3. 启动服务

**启动后端：**
```bash
cd backend
npm start
```

后端将运行在 `http://localhost:3001`

**启动前端（开发模式）：**
```bash
cd frontend
npm start
```

前端将运行在 `http://localhost:3000`

### 4. 使用工具

#### 方式一：直接打开前端文件（推荐）
```bash
open frontend/public/index.html
```
或在浏览器中打开：
```
file:///Users/liting/youtube-scraper/frontend/public/index.html
```

#### 方式二：使用开发服务器
在浏览器中打开 `http://localhost:3000`

**YouTube抓取功能**：
1. 切换到「YouTube抓取」标签
2. 输入关键词（支持多个，用逗号或换行分隔）
3. 设置最大抓取数量和抓取间隔
4. 点击"开始抓取"
5. 等待抓取完成，查看结果
6. 点击"导出Excel"保存数据

**邮件发送功能**：
1. 切换到「邮件发送」标签
2. 配置SMTP信息（发件邮箱、SMTP服务器、端口、密码）
3. 编辑邮件内容（支持 {客户名称} 变量）
4. 上传客户Excel文件
5. 选择要发送的客户
6. 点击"发送邮件"

详细说明请查看：
- 📖 [邮件功能使用说明](邮件功能使用说明.md)
- 🚀 [快速测试指南](快速测试指南.md)

## 项目结构

```
youtube-scraper/
├── backend/
│   ├── server.js           # Express服务器
│   ├── services/
│   │   ├── youtubeService.js  # YouTube抓取服务
│   │   └── emailService.js    # 邮件发送服务 🆕
│   ├── package.json
│   └── .env.example        # 环境变量示例
├── frontend/
│   ├── public/
│   │   ├── index.html      # 主页面（含邮件发送界面）
│   │   └── app.js          # 前端逻辑（含邮件功能）
│   └── package.json
├── 邮件功能使用说明.md      # 邮件功能详细文档 🆕
├── 快速测试指南.md          # 快速上手指南 🆕
├── start.sh                # 快速启动脚本 🆕
└── README.md
```

## 使用说明

### 关键词输入
- 支持单个或多个关键词
- 多个关键词用逗号或换行分隔
- 例如：`数字营销, SEO教程, 社交媒体营销`

### 参数设置
- **最大抓取数量**：总共最多抓取的频道数（10-500）
- **抓取间隔**：每个频道抓取间隔，单位毫秒（1000-10000）

### 结果导出
- 支持导出为Excel格式（.xlsx）
- 包含所有抓取的频道信息和联系方式

## 注意事项

⚠️ **抓取限制**
- YouTube可能会检测自动化访问
- 建议设置合理的抓取间隔（2000ms以上）
- 大量抓取时可能需要使用代理IP

⚠️ **使用限制**
- 仅用于合法的商业营销目的
- 遵守YouTube服务条款
- 不得用于垃圾邮件或骚扰

⚠️ **联系方式准确性**
- 部分频道可能未公开联系方式
- 系统会标注"无"或"未识别"
- 建议人工验证重要联系信息

⚠️ **首次运行**
- Puppeteer首次运行会下载Chromium（约150MB）
- 请耐心等待下载完成

## 生产部署

### 使用PM2部署后端

```bash
cd backend
npm install -g pm2
pm2 start server.js --name youtube-scraper
pm2 save
pm2 startup
```

### 使用Nginx部署前端

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/frontend/build;
        try_files $uri /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Docker部署（可选）

创建 `Dockerfile`：
```dockerfile
FROM browserless/chrome:latest

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 3001

CMD ["npm", "start"]
```

## 故障排除

**问题：Puppeteer无法启动**
- 解决：运行 `node node_modules/puppeteer/install.js` 手动下载Chromium

**问题：YouTube要求验证**
- 原因：触发了YouTube反爬机制
- 解决：增加抓取间隔，或使用代理IP

**问题：抓取速度慢**
- 原因：间隔设置过长或网络问题
- 解决：适当减小抓取间隔（不建议低于1000ms）

**问题：部分频道无联系方式**
- 原因：频道确实未公开联系方式
- 解决：这是正常现象，不是系统故障

## 许可证

MIT License

## 更新日志

### v3.0.0 (2026-05-04) 🆕
- 新增邮件营销自动化功能
- 支持上传Excel客户列表批量发送邮件
- 支持自定义邮件模板保存和加载
- 邮件内容支持变量替换
- 实时显示发送进度和结果
- 失败邮件支持重试发送
- 界面优化，使用标签页切换功能

### v2.0.0 (2024-04-27)
- 移除YouTube API依赖
- 改用Puppeteer无头浏览器直接抓取
- 优化频道匹配算法
- 支持自动翻页

## 常见问题

**Q: 如何配置SMTP发送邮件？**
A: 请查看 [邮件功能使用说明](邮件功能使用说明.md) 中的详细配置指南。

**Q: 支持哪些邮箱服务商？**
A: 支持所有标准SMTP协议的邮箱，包括QQ、163、Gmail、Outlook、企业邮箱等。

**Q: 邮件发送失败怎么办？**
A: 检查SMTP配置是否正确，确认已开启SMTP服务，使用授权码而非密码。

**Q: 如何避免被判定为垃圾邮件？**
A: 建议设置2-5秒的发送间隔，确保收件人同意接收邮件，避免使用敏感词汇。
