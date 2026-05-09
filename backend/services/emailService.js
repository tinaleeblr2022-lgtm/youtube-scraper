const nodemailer = require('nodemailer');
const xlsx = require('xlsx');

/**
 * 邮件发送服务
 */
class EmailService {
  constructor() {
    this.transporter = null;
  }

  /**
   * 创建SMTP传输器
   */
  createTransporter(smtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.port === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass
      }
    });
  }

  /**
   * 测试SMTP连接
   */
  async testConnection(smtpConfig) {
    try {
      this.createTransporter(smtpConfig);
      await this.transporter.verify();
      return { success: true, message: 'SMTP连接测试成功' };
    } catch (error) {
      return { success: false, message: `SMTP连接失败: ${error.message}` };
    }
  }

  /**
   * 解析Excel文件
   */
  parseExcelFile(buffer) {
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);

      // 自动识别列名（支持多种命名方式）
      const parsedData = data.map(row => {
        const keys = Object.keys(row);

        // 查找客户名称列
        const nameKey = keys.find(key =>
          key.includes('客户') ||
          key.includes('名称') ||
          key.includes('姓名') ||
          key.toLowerCase().includes('name') ||
          key.toLowerCase().includes('customer')
        );

        // 查找邮箱列
        const emailKey = keys.find(key =>
          key.includes('邮箱') ||
          key.includes('邮件') ||
          key.includes('email') ||
          key.includes('mail')
        );

        return {
          name: nameKey ? row[nameKey] : '',
          email: emailKey ? row[emailKey] : '',
          originalData: row
        };
      }).filter(item => item.email); // 只保留有邮箱的行

      return { success: true, data: parsedData };
    } catch (error) {
      return { success: false, message: `Excel解析失败: ${error.message}` };
    }
  }

  /**
   * 替换邮件模板中的变量
   */
  replaceTemplateVariables(template, customerName) {
    return template.replace(/\{客户名称\}/g, customerName || '客户');
  }

  /**
   * 发送单封邮件
   */
  async sendEmail(to, subject, text, html = null) {
    try {
      const mailOptions = {
        from: this.transporter.options.auth.user,
        to: to,
        subject: subject,
        text: text
      };

      if (html) {
        mailOptions.html = html;
      }

      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 批量发送邮件
   */
  async sendBulkEmails(recipients, subject, bodyTemplate, options = {}) {
    const {
      interval = 2, // 发送间隔（秒）
      onProgress = null // 进度回调
    } = options;

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      // 替换模板变量
      const personalizedBody = this.replaceTemplateVariables(bodyTemplate, recipient.name);
      const personalizedSubject = this.replaceTemplateVariables(subject, recipient.name);

      // 发送邮件
      const result = await this.sendEmail(recipient.email, personalizedSubject, personalizedBody);

      const emailResult = {
        index: i + 1,
        name: recipient.name,
        email: recipient.email,
        success: result.success,
        message: result.success ? '发送成功' : result.message,
        messageId: result.messageId
      };

      results.push(emailResult);

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }

      // 更新进度
      if (onProgress) {
        onProgress({
          total: recipients.length,
          sent: i + 1,
          success: successCount,
          failed: failCount,
          current: recipient
        });
      }

      // 等待指定间隔（最后一次不需要等待）
      if (i < recipients.length - 1 && interval > 0) {
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
      }
    }

    return {
      success: true,
      results: results,
      summary: {
        total: recipients.length,
        success: successCount,
        failed: failCount
      }
    };
  }

  /**
   * 重试发送失败的邮件
   */
  async retryFailedEmails(failedResults, subject, bodyTemplate, options = {}) {
    const failedRecipients = failedResults
      .filter(r => !r.success)
      .map(r => ({
        name: r.name,
        email: r.email
      }));

    if (failedRecipients.length === 0) {
      return { success: true, message: '没有需要重试的邮件', results: [], summary: { total: 0, success: 0, failed: 0 } };
    }

    return await this.sendBulkEmails(failedRecipients, subject, bodyTemplate, options);
  }
}

module.exports = new EmailService();
