const express = require('express');
const cors = require('cors');
const multer = require('multer');
const youtubeService = require('./services/youtubeService');
const emailService = require('./services/emailService');
const app = express();
const PORT = process.env.PORT || 3001;

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制10MB
  }
});

app.use(cors());
app.use(express.json());

app.post('/api/scrape', async (req, res) => {
  try {
    const { url, delay = 2000 } = req.body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: '请提供 YouTube 搜索结果页面的 URL' });
    }

    const trimmedUrl = url.trim();

    if (!trimmedUrl.includes('youtube.com')) {
      return res.status(400).json({ error: '请输入有效的 YouTube 网页链接' });
    }

    console.log(`开始解析 YouTube 页面: ${trimmedUrl}`);

    const results = await youtubeService.scrapeFromUrl(trimmedUrl, delay);

    res.json({
      success: true,
      data: results,
      total: results.length,
      message: `成功解析 ${results.length} 个频道`
    });
  } catch (error) {
    console.error('抓取失败:', error);
    res.status(500).json({
      error: '抓取失败',
      details: error.message
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ========== 邮件相关API ==========

// 测试SMTP连接
app.post('/api/email/test-smtp', async (req, res) => {
  try {
    const { smtpConfig } = req.body;

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass) {
      return res.status(400).json({ error: '请填写完整的SMTP配置信息' });
    }

    const result = await emailService.testConnection(smtpConfig);
    res.json(result);
  } catch (error) {
    console.error('SMTP测试失败:', error);
    res.status(500).json({ error: 'SMTP测试失败', details: error.message });
  }
});

// 解析Excel文件
app.post('/api/email/parse-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传Excel文件' });
    }

    const result = emailService.parseExcelFile(req.file.buffer);

    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        total: result.data.length,
        message: `成功解析 ${result.data.length} 个客户`
      });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Excel解析失败:', error);
    res.status(500).json({ error: 'Excel解析失败', details: error.message });
  }
});

// 发送邮件
app.post('/api/email/send', async (req, res) => {
  try {
    const { smtpConfig, recipients, subject, body, interval } = req.body;

    if (!smtpConfig || !recipients || !subject || !body) {
      return res.status(400).json({ error: '请填写完整的邮件信息' });
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: '请选择要发送的客户' });
    }

    // 创建SMTP传输器
    emailService.createTransporter(smtpConfig);

    // 发送邮件
    const result = await emailService.sendBulkEmails(recipients, subject, body, {
      interval: interval || 2,
      onProgress: (progress) => {
        // 可以通过WebSocket发送实时进度，这里简化处理
        console.log(`发送进度: ${progress.sent}/${progress.total}, 成功: ${progress.success}, 失败: ${progress.failed}`);
      }
    });

    res.json({
      success: true,
      data: result.results,
      summary: result.summary,
      message: `发送完成：成功 ${result.summary.success} 个，失败 ${result.summary.failed} 个`
    });
  } catch (error) {
    console.error('邮件发送失败:', error);
    res.status(500).json({ error: '邮件发送失败', details: error.message });
  }
});

// 重试发送失败的邮件
app.post('/api/email/retry', async (req, res) => {
  try {
    const { smtpConfig, failedResults, subject, body, interval } = req.body;

    if (!smtpConfig || !failedResults || !subject || !body) {
      return res.status(400).json({ error: '请填写完整的信息' });
    }

    // 创建SMTP传输器
    emailService.createTransporter(smtpConfig);

    // 重试发送
    const result = await emailService.retryFailedEmails(failedResults, subject, body, {
      interval: interval || 2
    });

    res.json({
      success: true,
      data: result.results,
      summary: result.summary,
      message: result.message || `重试完成：成功 ${result.summary.success} 个，失败 ${result.summary.failed} 个`
    });
  } catch (error) {
    console.error('重试发送失败:', error);
    res.status(500).json({ error: '重试发送失败', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`后端服务运行在 http://localhost:${PORT}`);
  console.log('请确保已配置 YOUTUBE_API_KEY 环境变量');
});
