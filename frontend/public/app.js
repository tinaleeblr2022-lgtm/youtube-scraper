const API_BASE_URL = 'http://47.86.176.227:3001/api';
let scrapedData = [];
let emailCustomers = [];
let emailSendResults = [];
let emailTemplates = [];

// 标签页切换
function switchTab(tabName) {
  const tabs = document.querySelectorAll('.tab-button');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => tab.classList.remove('active'));
  contents.forEach(content => content.classList.remove('active'));

  if (tabName === 'youtube') {
    tabs[0].classList.add('active');
    document.getElementById('youtubeTab').classList.add('active');
  } else {
    tabs[1].classList.add('active');
    document.getElementById('emailTab').classList.add('active');
  }
}

async function startScraping() {
  const urlInput = document.getElementById('youtubeUrl').value.trim();
  const delay = parseInt(document.getElementById('delay').value);

  if (!urlInput) {
    showMessage('请粘贴 YouTube 搜索结果页面的链接', 'error');
    return;
  }

  if (!urlInput.includes('youtube.com')) {
    showMessage('请输入有效的 YouTube 网页链接', 'error');
    return;
  }

  const scrapeBtn = document.getElementById('scrapeBtn');
  scrapeBtn.disabled = true;
  scrapeBtn.innerHTML = '抓取中<span class="loading-spinner"></span>';

  showProgress(true);
  updateProgress(0, '正在解析 YouTube 页面...');

  try {
    const response = await fetch(`${API_BASE_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: urlInput,
        delay: delay
      })
    });

    const result = await response.json();

    if (result.success) {
      scrapedData = result.data.filter(item => !item.error);

      updateProgress(100, '抓取完成！');
      displayResults(scrapedData);

      showMessage(`成功解析 ${scrapedData.length} 个频道`, 'success');
    } else {
      throw new Error(result.error || '抓取失败');
    }

  } catch (error) {
    console.error('抓取错误:', error);
    showMessage(`抓取失败: ${error.message}`, 'error');
    showProgress(false);
  } finally {
    scrapeBtn.disabled = false;
    scrapeBtn.innerHTML = '开始抓取';
  }
}

function displayResults(data) {
  const resultsSection = document.getElementById('resultsSection');
  const resultsBody = document.getElementById('resultsBody');
  const resultsStats = document.getElementById('resultsStats');

  resultsBody.innerHTML = '';

  if (data.length === 0) {
    resultsBody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#adb5bd;">暂无数据</td></tr>';
    resultsStats.textContent = '共 0 个频道';
  } else {
    data.forEach((channel, index) => {
      const row = document.createElement('tr');

      const formatNumber = (num) => {
        if (!num) return '-';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      };

      const formatContact = (value) => {
        if (!value) return '<span class="no-contact">无</span>';
        return `<a href="${value}" target="_blank" class="contact-link">查看</a>`;
      };

      const formatOtherContacts = (contacts) => {
        if (!contacts || contacts.length === 0) return '<span class="no-contact">无</span>';
        return contacts.map(c => `${c.type}: <a href="${c.value}" target="_blank" class="contact-link">查看</a>`).join('<br>');
      };

      const formatTime = (timeStr) => {
        const date = new Date(timeStr);
        return date.toLocaleString('zh-CN');
      };

      row.innerHTML = `
        <td>${index + 1}</td>
        <td><strong>${channel.channelName}</strong></td>
        <td><a href="${channel.channelUrl}" target="_blank" class="contact-link">访问频道</a></td>
        <td>${channel.country || '<span class="no-contact">无</span>'}</td>
        <td>${channel.email || '<span class="no-contact">无</span>'}</td>
        <td>${formatContact(channel.instagram)}</td>
        <td>${formatContact(channel.telegram)}</td>
        <td>${formatContact(channel.discord)}</td>
        <td>${formatOtherContacts(channel.otherContacts)}</td>
        <td>${formatNumber(channel.subscriberCount)}</td>
        <td>${formatTime(channel.scrapeTime)}</td>
      `;

      resultsBody.appendChild(row);
    });

    resultsStats.textContent = `共 ${data.length} 个频道`;
  }

  resultsSection.classList.add('active');
  showProgress(false);
}

function updateProgress(percent, text) {
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  progressFill.style.width = percent + '%';
  progressFill.textContent = percent + '%';
  progressText.textContent = text;
}

function showProgress(show) {
  const progressSection = document.getElementById('progressSection');
  if (show) {
    progressSection.classList.add('active');
  } else {
    progressSection.classList.remove('active');
  }
}

function showMessage(message, type) {
  const container = document.getElementById('messageContainer');
  const messageDiv = document.createElement('div');

  messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
  messageDiv.textContent = message;

  container.innerHTML = '';
  container.appendChild(messageDiv);

  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}

function clearResults() {
  scrapedData = [];
  document.getElementById('resultsSection').classList.remove('active');
  document.getElementById('resultsBody').innerHTML = '';
  document.getElementById('youtubeUrl').value = '';
  document.getElementById('messageContainer').innerHTML = '';
  showProgress(false);
}

async function exportToExcel() {
  if (scrapedData.length === 0) {
    showMessage('没有数据可导出', 'error');
    return;
  }

  try {
    const XLSX = await loadXLSX();

    const exportData = scrapedData.map((channel, index) => ({
      '序号': index + 1,
      '频道名称': channel.channelName,
      '频道链接': channel.channelUrl,
      '国家地区': channel.country || '无',
      '邮箱': channel.email || '无',
      'Instagram': channel.instagram || '无',
      'Telegram': channel.telegram || '无',
      'Discord': channel.discord || '无',
      '其他联系方式': channel.otherContacts && channel.otherContacts.length > 0
        ? channel.otherContacts.map(c => `${c.type}:${c.value}`).join('; ')
        : '无',
      '粉丝数': channel.subscriberCount || '无',
      '视频数': channel.videoCount || '无',
      '抓取时间': new Date(channel.scrapeTime).toLocaleString('zh-CN'),
      '匹配关键词': channel.matchedKeyword
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'YouTube频道');

    const fileName = `YouTube频道抓取_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    showMessage(`成功导出 ${scrapedData.length} 条数据到 ${fileName}`, 'success');

  } catch (error) {
    console.error('导出失败:', error);
    showMessage('导出失败，请检查网络连接', 'error');
  }
}

async function loadXLSX() {
  if (window.XLSX) {
    return window.XLSX;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.18.5/package/dist/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

document.getElementById('youtubeUrl').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    startScraping();
  }
});

// ========== 邮件发送功能 ==========

// 测试SMTP连接
async function testSMTP() {
  console.log('testSMTP called');
  const smtpConfig = getSMTPConfig();
  console.log('smtpConfig:', smtpConfig);

  if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass) {
    showEmailMessage('请填写完整的SMTP配置信息', 'error');
    return;
  }
  console.log('starting fetch...');

  try {
    const response = await fetch(`${API_BASE_URL}/email/test-smtp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smtpConfig })
    });
    console.log('fetch done');

    const result = await response.json();
    showEmailMessage(result.message, result.success ? 'success' : 'error');
  } catch (error) {
    console.error('fetch error:', error);
    showEmailMessage(`连接测试失败: ${error.message}`, 'error');
  }
}

function showEmailMessage(message, type) {
  const container = document.getElementById('smtpMessageContainer');
  if (!container) return;
  container.innerHTML = '';
  const messageDiv = document.createElement('div');
  messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
  messageDiv.textContent = message;
  container.appendChild(messageDiv);
  setTimeout(() => { messageDiv.remove(); }, 5000);
}

// 获取SMTP配置
function getSMTPConfig() {
  return {
    host: document.getElementById('smtpHost').value.trim(),
    port: parseInt(document.getElementById('smtpPort').value),
    user: document.getElementById('smtpEmail').value.trim(),
    pass: document.getElementById('smtpPass').value
  };
}

// 验证SMTP配置
function validateSMTPConfig(config) {
  if (!config.host || !config.port || !config.user || !config.pass) {
    showMessage('请填写完整的SMTP配置信息', 'error');
    return false;
  }
  return true;
}

// 处理文件上传
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.xlsx')) {
    showMessage('请上传.xlsx格式的Excel文件', 'error');
    return;
  }

  const fileInfo = document.getElementById('fileInfo');
  fileInfo.innerHTML = `
    <span>📄 ${file.name}</span>
    <button class="btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="clearFile()">清除</button>
  `;
  fileInfo.classList.add('active');

  parseExcelFile(file);
}

// 解析Excel文件
async function parseExcelFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/email/parse-excel`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      emailCustomers = result.data.map((customer, index) => ({
        ...customer,
        selected: true,
        index: index + 1
      }));
      displayCustomerTable();
      showMessage(`成功解析 ${result.data.length} 个客户`, 'success');
    } else {
      showMessage(result.error || 'Excel解析失败', 'error');
    }
  } catch (error) {
    showMessage(`解析失败: ${error.message}`, 'error');
  }
}

// 显示客户表格
function displayCustomerTable() {
  const tableSection = document.getElementById('customerTableSection');
  const tableBody = document.getElementById('customerTableBody');

  tableBody.innerHTML = '';

  if (emailCustomers.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#adb5bd;">暂无数据</td></tr>';
  } else {
    emailCustomers.forEach((customer, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="checkbox-column">
          <input type="checkbox" ${customer.selected ? 'checked' : ''} onchange="toggleCustomer(${index})">
        </td>
        <td>${index + 1}</td>
        <td>${customer.name || '-'}</td>
        <td>${customer.email}</td>
      `;
      tableBody.appendChild(row);
    });
  }

  tableSection.style.display = 'block';
}

// 切换客户选择
function toggleCustomer(index) {
  emailCustomers[index].selected = !emailCustomers[index].selected;
}

// 全选/取消全选
function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll').checked;
  emailCustomers.forEach(customer => customer.selected = selectAll);
  displayCustomerTable();
}

// 清除文件
function clearFile() {
  document.getElementById('fileInput').value = '';
  document.getElementById('fileInfo').classList.remove('active');
  document.getElementById('customerTableSection').style.display = 'none';
  emailCustomers = [];
}

// 发送邮件
async function sendEmails() {
  const smtpConfig = getSMTPConfig();

  if (!validateSMTPConfig(smtpConfig)) {
    return;
  }

  const selectedCustomers = emailCustomers.filter(c => c.selected);

  if (selectedCustomers.length === 0) {
    showMessage('请至少选择一个客户', 'error');
    return;
  }

  const subject = document.getElementById('emailSubject').value.trim();
  const body = document.getElementById('emailBody').value.trim();
  const interval = parseInt(document.getElementById('sendInterval').value) || 2;

  if (!subject || !body) {
    showMessage('请填写邮件标题和正文', 'error');
    return;
  }

  // 显示进度
  const sendProgress = document.getElementById('sendProgress');
  sendProgress.classList.add('active');
  updateEmailProgress(0, 1, 0, 0);

  try {
    const response = await fetch(`${API_BASE_URL}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smtpConfig,
        recipients: selectedCustomers,
        subject,
        body,
        interval
      })
    });

    const result = await response.json();

    if (result.success) {
      emailSendResults = result.data;
      updateEmailProgress(result.summary.total, result.summary.total, result.summary.success, result.summary.failed);
      displayEmailResults(result.data);
      showMessage(`发送完成：成功 ${result.summary.success} 个，失败 ${result.summary.failed} 个`, result.summary.failed > 0 ? 'error' : 'success');
    } else {
      showMessage(result.error || '发送失败', 'error');
    }
  } catch (error) {
    showMessage(`发送失败: ${error.message}`, 'error');
  } finally {
    sendProgress.classList.remove('active');
  }
}

// 更新邮件发送进度
function updateEmailProgress(total, sent, success, failed) {
  const percent = total > 0 ? Math.round((sent / total) * 100) : 0;
  document.getElementById('emailProgressFill').style.width = percent + '%';
  document.getElementById('emailProgressFill').textContent = percent + '%';
  document.getElementById('emailProgressText').textContent = `已发送 ${sent}/${total}`;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statSent').textContent = sent;
  document.getElementById('statSuccess').textContent = success;
  document.getElementById('statFailed').textContent = failed;
}

// 显示邮件发送结果
function displayEmailResults(results) {
  const resultsSection = document.getElementById('emailResultsSection');
  const resultsList = document.getElementById('emailResultsList');

  resultsList.innerHTML = '';

  results.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = `result-item ${result.success ? 'result-success' : 'result-failed'}`;
    resultItem.innerHTML = `
      <strong>${result.index}. ${result.name || '未命名'}</strong> (${result.email})<br>
      ${result.success ? '✅ 发送成功' : `❌ ${result.message}`}
    `;
    resultsList.appendChild(resultItem);
  });

  resultsSection.style.display = 'block';
}

// 重试失败的邮件
async function retryFailed() {
  const failedResults = emailSendResults.filter(r => !r.success);

  if (failedResults.length === 0) {
    showMessage('没有失败的邮件需要重试', 'error');
    return;
  }

  const smtpConfig = getSMTPConfig();
  const subject = document.getElementById('emailSubject').value.trim();
  const body = document.getElementById('emailBody').value.trim();
  const interval = parseInt(document.getElementById('sendInterval').value) || 2;

  if (!subject || !body) {
    showMessage('请填写邮件标题和正文', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/email/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smtpConfig,
        failedResults: failedResults,
        subject,
        body,
        interval
      })
    });

    const result = await response.json();

    if (result.success) {
      emailSendResults = result.data;
      displayEmailResults(result.data);
      showMessage(`重试完成：成功 ${result.summary.success} 个，失败 ${result.summary.failed} 个`, result.summary.failed > 0 ? 'error' : 'success');
    } else {
      showMessage(result.error || '重试失败', 'error');
    }
  } catch (error) {
    showMessage(`重试失败: ${error.message}`, 'error');
  }
}

// 模板管理
function saveTemplate() {
  const name = prompt('请输入模板名称：');
  if (!name) return;

  const subject = document.getElementById('emailSubject').value.trim();
  const body = document.getElementById('emailBody').value.trim();

  if (!subject || !body) {
    showMessage('请先填写邮件标题和正文', 'error');
    return;
  }

  const template = {
    id: Date.now(),
    name,
    subject,
    body,
    createdAt: new Date().toISOString()
  };

  // 检查是否已存在同名模板
  const existingIndex = emailTemplates.findIndex(t => t.name === name);
  if (existingIndex >= 0) {
    emailTemplates[existingIndex] = template;
  } else {
    emailTemplates.push(template);
  }

  saveTemplatesToStorage();
  updateTemplateSelect();
  showMessage(`模板 "${name}" 已保存`, 'success');
}

function loadTemplate() {
  const select = document.getElementById('templateSelect');
  const templateId = parseInt(select.value);

  if (!templateId) {
    return;
  }

  const template = emailTemplates.find(t => t.id === templateId);
  if (template) {
    document.getElementById('emailSubject').value = template.subject;
    document.getElementById('emailBody').value = template.body;
    showMessage(`已加载模板 "${template.name}"`, 'success');
  }
}

function deleteTemplate() {
  const select = document.getElementById('templateSelect');
  const templateId = parseInt(select.value);

  if (!templateId) {
    showMessage('请先选择要删除的模板', 'error');
    return;
  }

  const template = emailTemplates.find(t => t.id === templateId);
  if (confirm(`确定要删除模板 "${template.name}" 吗？`)) {
    emailTemplates = emailTemplates.filter(t => t.id !== templateId);
    saveTemplatesToStorage();
    updateTemplateSelect();
    showMessage(`模板 "${template.name}" 已删除`, 'success');
  }
}

function updateTemplateSelect() {
  const select = document.getElementById('templateSelect');
  select.innerHTML = '<option value="">-- 选择模板 --</option>';

  emailTemplates.forEach(template => {
    const option = document.createElement('option');
    option.value = template.id;
    option.textContent = template.name;
    select.appendChild(option);
  });
}

function saveTemplatesToStorage() {
  localStorage.setItem('emailTemplates', JSON.stringify(emailTemplates));
}

function loadTemplatesFromStorage() {
  const stored = localStorage.getItem('emailTemplates');
  if (stored) {
    emailTemplates = JSON.parse(stored);
    updateTemplateSelect();
  }
}

// 拖拽上传支持
const uploadArea = document.getElementById('uploadArea');

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');

  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.xlsx')) {
    document.getElementById('fileInput').files = e.dataTransfer.files;
    handleFileUpload({ target: { files: [file] } });
  } else {
    showMessage('请上传.xlsx格式的Excel文件', 'error');
  }
});

// 页面加载时初始化
loadTemplatesFromStorage();
