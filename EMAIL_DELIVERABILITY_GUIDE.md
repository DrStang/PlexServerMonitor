# Email Deliverability Guide

This guide helps ensure your Plex Server Monitor emails reach recipients' inboxes instead of spam folders.

## 🚀 Quick Start (Recommended)

**Use a transactional email service** instead of sending directly from Gmail:

| Service | Free Tier | Best For |
|---------|-----------|----------|
| **SendGrid** | 12,000 emails/month | Best balance of features and free tier |
| **Amazon SES** | 62,000 emails/month | High volume, AWS users |
| **Mailgun** | 5,000 emails/month | Developers, API-first |
| **Postmark** | 100 emails/month | Transactional emails, quality focus |

## 📧 Email Service Setup

### Option 1: SendGrid (Recommended)

1. **Sign up:** https://sendgrid.com
2. **Create API Key:**
   - Settings → API Keys → Create API Key
   - Choose "Full Access" or "Restricted Access" with Mail Send permissions
3. **Update `.env`:**
   ```bash
   EMAIL_HOST=smtp.sendgrid.net
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=apikey
   EMAIL_PASSWORD=SG.your-actual-api-key-here
   EMAIL_FROM=Plex Server Monitor <noreply@yourdomain.com>
   ```

### Option 2: Gmail (Simple but Limited)

1. **Enable 2-Factor Authentication:**
   - Google Account → Security → 2-Step Verification
2. **Create App Password:**
   - Google Account → Security → App Passwords
   - Select "Mail" and your device
   - Copy the 16-character password
3. **Update `.env`:**
   ```bash
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   EMAIL_FROM=Plex Server Monitor <your-email@gmail.com>
   ```

**Gmail Limitations:**
- 500 emails/day limit
- Higher spam risk for mass emails
- May require additional authentication

### Option 3: Amazon SES

1. **Sign up:** https://aws.amazon.com/ses/
2. **Verify your domain** in SES Console
3. **Request production access** (starts in sandbox mode)
4. **Create SMTP credentials:**
   - SES Console → SMTP Settings → Create SMTP Credentials
5. **Update `.env`:**
   ```bash
   EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your-ses-smtp-username
   EMAIL_PASSWORD=your-ses-smtp-password
   EMAIL_FROM=Plex Server Monitor <noreply@yourdomain.com>
   ```

## 🔐 DNS Authentication (Critical for Deliverability)

If using a custom domain, configure these DNS records:

### 1. SPF (Sender Policy Framework)

Add a TXT record to your domain:

**For SendGrid:**
```
v=spf1 include:sendgrid.net ~all
```

**For Gmail:**
```
v=spf1 include:_spf.google.com ~all
```

**For Amazon SES:**
```
v=spf1 include:amazonses.com ~all
```

### 2. DKIM (DomainKeys Identified Mail)

Each service provides DKIM records:
- **SendGrid:** Settings → Sender Authentication → Domain Authentication
- **Gmail:** Admin Console → Apps → Google Workspace → Gmail → Authenticate Email
- **Amazon SES:** SES Console → Verified Identities → DKIM

### 3. DMARC (Domain-based Message Authentication)

Add this TXT record to `_dmarc.yourdomain.com`:
```
v=DMARC1; p=quarantine; rua=mailto:dandolewski@gmail.com
```

**What it means:**
- `p=quarantine`: Put suspicious emails in spam
- `rua=mailto:...`: Send reports to this email

## ✅ Email Content Best Practices

### ✓ Do's

1. **Include plain text version** (✓ Already implemented)
2. **Use proper HTML structure** (✓ Already implemented)
3. **Include unsubscribe link** for mass emails
4. **Use clear, descriptive subjects**
5. **Keep HTML simple** - avoid excessive images
6. **Personalize content** when possible
7. **Use proper FROM name** (e.g., "Plex Server Monitor <noreply@domain.com>")

### ✗ Avoid

1. ❌ ALL CAPS SUBJECTS
2. ❌ Excessive exclamation marks!!!
3. ❌ Spam trigger words: "FREE", "ACT NOW", "$$$"
4. ❌ URL shorteners (bit.ly, tinyurl)
5. ❌ Sending to too many recipients at once
6. ❌ Inconsistent sending patterns

## 🎯 Testing Email Deliverability

### 1. Mail Tester
- Visit https://www.mail-tester.com
- Send a test email to the provided address
- Get a score /10 with detailed feedback

### 2. GlockApps
- https://glockapps.com
- Tests spam filters across providers

### 3. Check DNS Records
```bash
dig TXT yourdomain.com
dig TXT _dmarc.yourdomain.com
```

## 📊 Monitoring

### Check Email Logs

Monitor your server logs for email delivery:
```bash
# Watch for email sending in real-time
tail -f server.log | grep "Email"
```

### Transactional Service Dashboards

- **SendGrid:** Activity → Email Activity
- **Amazon SES:** Metrics and Monitoring
- **Mailgun:** Analytics

## 🔧 Improvements Already Implemented

This system includes several deliverability improvements:

1. ✅ **Plain text + HTML versions** of all emails
2. ✅ **Rate limiting** (1 second delay between mass emails)
3. ✅ **Proper email headers** (X-Mailer, Priority)
4. ✅ **HTML escaping** to prevent malformed emails
5. ✅ **Professional email templates** with proper structure
6. ✅ **Non-blocking email sending** (doesn't break app if email fails)

## 🆘 Troubleshooting

### Emails going to spam?

1. **Check SPF/DKIM/DMARC** using https://mxtoolbox.com
2. **Test with Mail Tester** (see above)
3. **Check sender reputation:** https://senderscore.org
4. **Verify "FROM" email** is authenticated
5. **Ask recipients to whitelist** your email address

### Emails not sending?

1. **Check logs:** Look for error messages
2. **Verify credentials:** Test SMTP connection
3. **Check firewall:** Ensure port 587 is open
4. **Verify email service status:** Check provider status page

### Gmail not working?

1. **Ensure 2FA is enabled**
2. **Use App Password** (not regular password)
3. **Check "Less secure app access"** (if not using App Password)
4. **Review security alerts** in Google Account

## 📈 Best Practices Summary

1. **Use a transactional email service** (SendGrid, SES, Mailgun)
2. **Configure DNS authentication** (SPF, DKIM, DMARC)
3. **Use a verified domain** instead of generic Gmail
4. **Keep email content clean** and professional
5. **Rate limit** mass emails (already implemented)
6. **Monitor delivery rates** through service dashboard
7. **Ask users to whitelist** your email address
8. **Include unsubscribe option** for mass emails

## 🔗 Useful Resources

- [SendGrid Setup Guide](https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api)
- [Amazon SES Guide](https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html)
- [SPF Record Checker](https://mxtoolbox.com/spf.aspx)
- [DKIM Validator](https://dkimvalidator.com/)
- [Email on Acid - Testing Tool](https://www.emailonacid.com/)

---

**Need help?** Check your email service's documentation or contact their support team.
