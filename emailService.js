const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('Email configuration not found. Mass email feature will be disabled.');
      return;
    }

    try {
      // Support both service-based (Gmail, etc) and custom SMTP configuration
      const transportConfig = process.env.EMAIL_SERVICE
        ? {
            service: process.env.EMAIL_SERVICE,
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASSWORD
            }
          }
        : {
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT || 587,
            secure: process.env.EMAIL_SECURE === 'true' || false,
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASSWORD
            }
          };

      this.transporter = nodemailer.createTransport(transportConfig);

      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('Email service verification failed:', error);
          console.log('Email features will be disabled. You can still use all other features.');
          this.transporter = null;
        } else {
          console.log('Email service is ready');
        }
      });
    } catch (error) {
      console.error('Failed to initialize email service:', error.message);
      console.log('Email features will be disabled. You can still use all other features.');
      this.transporter = null;
    }
  }

  async sendEmail(to, subject, html, text = null) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html,
      // Always include plain text version for better deliverability
      text: text || this.stripHtml(html),
      // Add headers to improve deliverability
      headers: {
        'X-Mailer': 'Plex Server Monitor',
        'X-Priority': '3',
        'Importance': 'Normal'
      },
      // Add list-unsubscribe header for mass emails compliance
      list: process.env.EMAIL_UNSUBSCRIBE_URL ? {
        unsubscribe: process.env.EMAIL_UNSUBSCRIBE_URL
      } : undefined
    };

    return this.transporter.sendMail(mailOptions);
  }

  // Helper to strip HTML for plain text version
  stripHtml(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async sendMassEmail(recipients, subject, html) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const results = {
      success: [],
      failed: []
    };

    // Rate limiting: delay between emails to avoid spam filters
    const delayMs = 1000; // 1 second between emails

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      try {
        await this.sendEmail(recipient.email, subject, html);
        results.success.push(recipient.email);

        // Add delay between emails (except for last email)
        if (i < recipients.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        console.error(`Failed to send email to ${recipient.email}:`, error.message);
        results.failed.push({
          email: recipient.email,
          error: error.message
        });
      }
    }

    return results;
  }

  async sendServerDownAlert(recipients) {
    const subject = 'Plex Server Status Alert - Server Down';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e5a00d;">Plex Server Status Alert</h2>
        <p>This is an automated notification to inform you that the Plex server is currently offline.</p>
        <p>Our team has been notified and is working to resolve the issue.</p>
        <p>We apologize for any inconvenience.</p>
        <hr style="border: 1px solid #ccc; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">
          This is an automated message from the Plex Server Monitor system.
        </p>
      </div>
    `;

    return this.sendMassEmail(recipients, subject, html);
  }

  async sendTicketUpdateNotification(email, ticketId, status) {
    const subject = `Ticket #${ticketId} Status Update`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e5a00d;">Ticket Status Update</h2>
        <p>Your ticket <strong>#${ticketId}</strong> has been updated.</p>
        <p>New status: <strong style="color: #e5a00d;">${status.toUpperCase()}</strong></p>
        <p>You can view your ticket details by logging into the Plex Server Monitor dashboard.</p>
        <hr style="border: 1px solid #ccc; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">
          This is an automated message from the Plex Server Monitor system.
        </p>
      </div>
    `;

    return this.sendEmail(email, subject, html);
  }

  async sendNewTicketNotification(adminEmail, ticketId, ticketData) {
    const subject = `New Support Ticket #${ticketId} Created`;

    // HTML version
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f4f4f4;">
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 5px;">
          <h2 style="color: #e5a00d; margin-top: 0;">New Support Ticket</h2>
          <p>A new support ticket has been submitted:</p>

          <table style="width: 100%; background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;" cellpadding="10">
            <tr>
              <td><strong>Ticket ID:</strong></td>
              <td>#${ticketId}</td>
            </tr>
            <tr>
              <td><strong>Title:</strong></td>
              <td>${this.escapeHtml(ticketData.title)}</td>
            </tr>
            <tr>
              <td><strong>Priority:</strong></td>
              <td><span style="color: ${this.getPriorityColor(ticketData.priority)};">${ticketData.priority.toUpperCase()}</span></td>
            </tr>
            <tr>
              <td><strong>Submitted by:</strong></td>
              <td>${this.escapeHtml(ticketData.username)} (${ticketData.email})</td>
            </tr>
            <tr>
              <td style="vertical-align: top;"><strong>Description:</strong></td>
              <td style="white-space: pre-wrap;">${this.escapeHtml(ticketData.description)}</td>
            </tr>
          </table>

          <p>Please log into the Plex Server Monitor admin dashboard to review and respond.</p>

          <hr style="border: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="font-size: 12px; color: #666; margin-bottom: 0;">
            This is an automated notification from the Plex Server Monitor system.<br>
            If you did not expect this email, please contact your system administrator.
          </p>
        </div>
      </body>
      </html>
    `;

    // Plain text version for better deliverability
    const text = `
New Support Ticket #${ticketId}

Ticket ID: #${ticketId}
Title: ${ticketData.title}
Priority: ${ticketData.priority.toUpperCase()}
Submitted by: ${ticketData.username} (${ticketData.email})

Description:
${ticketData.description}

Please log into the Plex Server Monitor admin dashboard to review and respond.

---
This is an automated notification from the Plex Server Monitor system.
    `.trim();

    return this.sendEmail(adminEmail, subject, html, text);
  }

  // Escape HTML to prevent XSS and improve content quality
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  getPriorityColor(priority) {
    const colors = {
      low: '#4caf50',
      medium: '#ff9800',
      high: '#f44336'
    };
    return colors[priority] || '#666';
  }

  isConfigured() {
    return this.transporter !== null;
  }
}

module.exports = new EmailService();
