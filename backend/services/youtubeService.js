const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

// 辅助函数：等待指定毫秒数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class YouTubeService {
  constructor() {
    this.browser = null;
  }

  async getBrowser() {
    if (!this.browser) {
      console.log('🌐 启动无头浏览器...');

      try {
        this.browser = await puppeteer.launch({
          executablePath: '/usr/bin/chromium-browser',
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080'
          ]
        });

        const testPage = await this.browser.newPage();
        await testPage.close();

        console.log('✅ 浏览器启动成功');
      } catch (error) {
        console.error('❌ 浏览器启动失败:', error.message);
        throw error;
      }
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // 新入口：接受用户粘贴的 YouTube 搜索结果 URL，解析当前页面内的所有频道
  async scrapeFromUrl(searchUrl, delay = 2000) {
    const seenChannelUrls = new Set();

    console.log(`🎯 开始解析用户提供的 YouTube 搜索页面`);
    console.log(`📎 URL: ${searchUrl}`);

    // 校验 URL 是否为 YouTube 搜索链接
    if (!searchUrl || !searchUrl.includes('youtube.com')) {
      throw new Error('请输入有效的 YouTube 网页链接');
    }

    const browser = await this.getBrowser();
    let page;

    try {
      page = await browser.newPage();
      console.log(`  📄 新页面已创建`);
    } catch (pageError) {
      console.error(`  ❌ 创建页面失败:`, pageError.message);
      throw pageError;
    }

    try {
      // 反检测措施
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {} };
      });

      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      });

      await page.setViewport({ width: 1920, height: 1080 });

      console.log(`  🌐 正在访问用户提供的页面...`);

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 120000
      });
      console.log(`  ✅ 页面加载成功`);

      // 等待页面内容加载
      await sleep(8000);

      // 保存截图用于调试
      const screenshotPath = `/tmp/youtube-debug-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  📸 页面截图已保存: ${screenshotPath}`);

      // 等待搜索结果卡片加载
      await page.waitForSelector('ytd-video-renderer, ytd-channel-renderer, ytd-rich-item-renderer', { timeout: 30000 }).catch(() => {
        console.log(`  ⚠️ 未找到视频/频道卡片元素`);
      });

      // 只滚动一次以加载懒加载内容，不做无限翻页
      console.log(`  📜 滚动一次以加载懒加载内容...`);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(3000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(1000);

      // 诊断：检查页面状态
      const pageState = await page.evaluate(() => {
        const results = {
          videoCount: document.querySelectorAll('ytd-video-renderer').length,
          channelCount: document.querySelectorAll('ytd-channel-renderer').length,
          videoCountAlt: document.querySelectorAll('ytd-rich-item-renderer').length,
          pageTitle: document.title,
          hasSearchBox: !!document.querySelector('input[name="search_query"], input#search'),
        };
        results.bodyTextPreview = document.body.innerText.substring(0, 200);
        return results;
      });
      console.log(`  📊 页面状态：视频卡片 ${pageState.videoCount} 个，频道卡片 ${pageState.channelCount} 个，rich-item ${pageState.videoCountAlt} 个`);
      console.log(`  📊 页面标题: "${pageState.pageTitle}"`);

      // 解析当前页面中的所有频道链接
      console.log(`  🔍 开始解析当前页面中的频道链接...`);

      const foundLinks = await page.evaluate(() => {
        const links = new Set();

        // 从视频卡片提取频道链接
        document.querySelectorAll('ytd-video-renderer').forEach(r => {
          const selectors = [
            '#meta #channel-name a[href*="/channel/"]',
            '#meta #channel-name a[href*="/@"]',
            '#meta ytd-channel-name a',
            '#channel-name a[href*="/channel/"]',
            '#channel-name a[href*="/@"]',
            'ytd-channel-name a[href*="/channel/"]',
            'ytd-channel-name a[href*="/@"]',
          ];
          for (const sel of selectors) {
            const a = r.querySelector(sel);
            if (a && a.href) {
              const href = a.href.split('?')[0];
              if (href.includes('/channel/') || href.includes('/@')) {
                links.add(href);
                break;
              }
            }
          }
        });

        // 从频道卡片提取链接（用户筛选了"频道"类型时）
        document.querySelectorAll('ytd-channel-renderer').forEach(r => {
          const a = r.querySelector('a#channel-thumbnail, a[href*="/channel/"], a[href*="/@"]');
          if (a && a.href) links.add(a.href.split('?')[0]);
        });

        // 从短视频/Reels 格式提取（rich-item-renderer）
        document.querySelectorAll('ytd-rich-item-renderer').forEach(r => {
          const a = r.querySelector('a[href*="/channel/"], a[href*="/@"]');
          if (a && a.href) {
            const href = a.href.split('?')[0];
            if (href.includes('/channel/') || href.includes('/@')) {
              links.add(href);
            }
          }
        });

        return [...links];
      });

      foundLinks.forEach(l => seenChannelUrls.add(l));
      const allChannelUrls = [...seenChannelUrls];

      console.log(`  ✅ 当前页面找到 ${allChannelUrls.length} 个唯一频道链接`);

      if (allChannelUrls.length === 0) {
        console.log(`  ⚠️ 未找到任何频道链接，请确认 URL 是 YouTube 搜索结果页面`);
        return [];
      }

      // 逐个获取频道详情（联系方式提取）
      const channels = [];
      const shortDelay = Math.max(delay, 300);

      for (let i = 0; i < allChannelUrls.length; i++) {
        const channelUrl = allChannelUrls[i];
        console.log(`  📌 [${i + 1}/${allChannelUrls.length}] 正在获取频道详情: ${channelUrl}`);
        try {
          const channelData = await this.getChannelDetails(channelUrl);
          if (channelData) {
            channels.push(channelData);
            console.log(`    ✅ ${channelData.channelName} | ${channelData.subscriberCount || '?'}`);
          }
        } catch (error) {
          console.log(`    ⚠️ ${channelUrl} 处理失败: ${error.message}`);
        }
        if (i < allChannelUrls.length - 1) {
          await this.sleep(shortDelay);
        }
      }

      console.log(`\n🎉 解析完成，共获取 ${channels.length} 个频道详情`);
      return channels;

    } catch (error) {
      console.error(`页面解析失败:`, error.message);
      throw error;
    } finally {
      await page.close();
    }
  }

  // 保留不变：获取频道详情和联系方式提取
  async getChannelDetails(channelUrl) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // 反检测
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {} };
      });

      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // 访问频道About页面
      let aboutUrl;
      if (channelUrl.includes('/@')) {
        aboutUrl = channelUrl.replace(/\/$/, '') + '/about';
      } else if (channelUrl.includes('/channel/')) {
        aboutUrl = channelUrl.replace(/\/$/, '') + '/about';
      } else {
        aboutUrl = channelUrl.replace(/\/$/, '') + '/about';
      }

      await page.goto(aboutUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 120000
      });

      // 等待页面加载
      await sleep(5000);

      // 提取频道信息
      const channelData = await page.evaluate(() => {
        // 获取频道名称：优先 og:title，其次 document.title
        let channelName = '未知频道';
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.content) {
          channelName = ogTitle.content.trim();
        } else if (document.title) {
          channelName = document.title.replace(/\s*-\s*YouTube\s*$/, '').trim();
        }

        // 获取频道URL
        const canonicalChannelUrl = window.location.href.split('/about')[0];

        // 从 about-channel-renderer 获取完整文本（包含粉丝数、视频数、简介）
        const aboutSection = document.querySelector('ytd-about-channel-renderer');
        const aboutText = aboutSection ? aboutSection.innerText : document.body.innerText;

        // 提取粉丝数：匹配 "123M subscribers" 或 "1.23亿位订阅者" 等格式
        let subscriberCount = '';
        const subMatch = aboutText.match(/([\d,.]+\s*(?:亿|万)?\s*(?:subscribers|位订阅者))/i);
        if (subMatch) subscriberCount = subMatch[1].trim();

        // 提取视频数
        let videoCount = '';
        const vidMatch = aboutText.match(/([\d,.]+\s*(?:个视频|videos))/i);
        if (vidMatch) videoCount = vidMatch[1].trim();

        // 提取国家/地区：从"更多信息"区块逐行查找，第一个短文本即为国家
        let country = '';
        const moreInfoIdx = aboutText.indexOf('更多信息');
        if (moreInfoIdx >= 0) {
          const afterMoreInfo = aboutText.substring(moreInfoIdx);
          const lines = afterMoreInfo.split('\n');
          // 从索引1开始跳过"更多信息"本身，忽略空行和已知行
          for (let i = 1; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (!trimmed) continue;
            if (/^(需登录|www\.|http|分享)/.test(trimmed)) continue;
            if (/订阅者|位订阅|视频|观看|注册/.test(trimmed)) continue;
            if (trimmed.length > 30) continue;
            if (/@/.test(trimmed)) continue;
            country = trimmed;
            break;
          }
        }

        // 提取邮箱
        const pageText = document.body.innerText;
        const emailMatch = pageText.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
        const email = emailMatch ? emailMatch[0] : '';

        // 提取社交媒体
        const instagramMatch = pageText.match(/(?:instagram\.com\/|@)[\w.-]+/i);
        const instagram = instagramMatch ? `https://www.${instagramMatch[0].startsWith('@') ? 'instagram.com/' + instagramMatch[0].slice(1) : instagramMatch[0]}` : '';

        const telegramMatch = pageText.match(/(?:t\.me\/|telegram\.me\/|@)[\w.-]+/i);
        const telegram = telegramMatch ? `https://t.me/${telegramMatch[0].replace(/@/, '')}` : '';

        const discordMatch = pageText.match(/discord\.gg\/[\w.-]+/i);
        const discord = discordMatch ? `https://${discordMatch[0]}` : '';

        // 其他联系方式
        const other = [];
        const patterns = [
          { regex: /twitter\.com\/[\w.-]+/i, name: 'Twitter' },
          { regex: /facebook\.com\/[\w.-]+/i, name: 'Facebook' },
          { regex: /tiktok\.com\/@?[\w.-]+/i, name: 'TikTok' },
          { regex: /wa\.me\/[\d]+/i, name: 'WhatsApp' },
          { regex: /twitch\.tv\/[\w.-]+/i, name: 'Twitch' }
        ];

        patterns.forEach(({ regex, name }) => {
          const match = pageText.match(regex);
          if (match && match[0]) {
            other.push({
              type: name,
              value: match[0].startsWith('http') ? match[0] : `https://${match[0]}`
            });
          }
        });

        // 获取描述/简介
        let description = '';
        if (aboutSection) {
          description = aboutSection.innerText.trim().substring(0, 500);
        }

        return {
          channelName: channelName,
          channelUrl: canonicalChannelUrl,
          subscriberCount: subscriberCount,
          videoCount: videoCount,
          country: country,
          email: email,
          instagram: instagram,
          telegram: telegram,
          discord: discord,
          otherContacts: other,
          description: description
        };
      });

      return {
        id: Date.now().toString(),
        ...channelData,
        scrapeTime: new Date().toISOString(),
        sourceUrl: channelUrl
      };

    } catch (error) {
      console.error(`获取频道详情失败:`, error.message);
      throw error;
    } finally {
      await page.close();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new YouTubeService();
