# Email Integration Guide

## Current Status
The account creation flow now includes:
- ✅ Email field in registration form
- ✅ Email stored in database instead of auto-generated @mudra.app
- ✅ Email API endpoint (`/api/auth/send-credentials`)
- ⏳ **Email sending is simulated** (logs to console)

## To Enable Real Email Sending

### Option 1: Resend (Recommended - Modern & Simple)

1. **Install Resend:**
```bash
npm install resend
```

2. **Get API Key:**
- Sign up at https://resend.com
- Get your API key from dashboard
- Add to `.env`:
```
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

3. **Update `/api/auth/send-credentials/route.ts`:**
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  // ... existing code ...
  
  const { data, error } = await resend.emails.send({
    from: 'Mudra <onboarding@yourdomain.com>',
    to: [email],
    subject: 'Your Mudra Beta Account Credentials',
    html: emailContent.html,
  })
  
  if (error) {
    throw new Error(error.message)
  }
  
  return NextResponse.json({ success: true })
}
```

### Option 2: SendGrid

1. **Install:**
```bash
npm install @sendgrid/mail
```

2. **Setup:**
```typescript
import sgMail from '@sendgrid/mail'
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

await sgMail.send({
  to: email,
  from: 'support@yourdomain.com',
  subject: 'Your Mudra Beta Account Credentials',
  html: emailContent.html,
})
```

### Option 3: Nodemailer (Self-hosted SMTP)

1. **Install:**
```bash
npm install nodemailer
```

2. **Setup:**
```typescript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

await transporter.sendMail({
  from: '"Mudra" <noreply@yourdomain.com>',
  to: email,
  subject: 'Your Mudra Beta Account Credentials',
  html: emailContent.html,
  text: emailContent.text,
})
```

## Testing Without Real Email

For testing, the current implementation:
- Logs credentials to console
- Shows success message in UI
- User can still copy password manually

## Security Notes

⚠️ **Important:** Sending passwords via email is generally not recommended for production. Consider:
- Using password reset links instead
- Requiring users to create their own password
- Implementing 2FA
- Using temporary passwords that expire

For beta testing purposes, this approach is acceptable as long as:
1. Users are informed it's beta
2. Email is sent over TLS
3. You're using a trusted email service
4. Passwords are strong and randomly generated

## Email Template Customization

The email template is in `/api/auth/send-credentials/route.ts`. You can customize:
- Subject line
- HTML styling
- Branding
- Additional instructions
- Links to documentation

## Environment Variables Needed

Add to your `.env` (depending on email service):

```bash
# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxx

# OR SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# OR SMTP (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASSWORD=your_app_password

# Base URL for links in email
NEXTAUTH_URL=https://yourdomain.com
```

## Next Steps

1. Choose an email provider
2. Install the corresponding package
3. Add API keys to `.env`
4. Update `/api/auth/send-credentials/route.ts`
5. Test with your own email first
6. Deploy and test in production

## Troubleshooting

**Email not sending:**
- Check API keys are correct
- Verify email service account is active
- Check console logs for errors
- Test with provider's test/sandbox mode first

**Email goes to spam:**
- Configure SPF, DKIM, DMARC records
- Use a verified sending domain
- Avoid spam trigger words
- Keep email simple and text-focused
