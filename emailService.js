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

    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE || false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('Email service verification failed:', error);
      } else {
        console.log('Email service is ready');
      }
    });
  }

  async sendEmail(to, subject, html) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendMassEmail(recipients, subject, html) {
    if (!this.transporter) {
      throw new Error('Email service not configured');
    }

    const results = {
      success: [],
      failed: []
    };

    for (const recipient of recipients) {
      try {
        await this.sendEmail(recipient.email, subject, html);
        results.success.push(recipient.email);
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

  isConfigured() {
    return this.transporter !== null;
  }
}

module.exports = new EmailService();
