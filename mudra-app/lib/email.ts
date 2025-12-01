import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'Mudra <noreply@mudra.ai>';
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your email address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify your email</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #000000; margin: 0; padding: 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #111111; border-radius: 12px; border: 1px solid #222222;">
                    <tr>
                      <td style="padding: 40px;">
                        <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                          Verify your email address
                        </h1>
                        <p style="color: #999999; font-size: 16px; line-height: 24px; margin: 0 0 30px 0; text-align: center;">
                          Thanks for signing up! Click the button below to verify your email address and get started with Mudra.
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 20px 0;">
                              <a href="${verificationUrl}" style="background-color: #ffffff; color: #000000; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                                Verify Email
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="color: #666666; font-size: 14px; line-height: 20px; margin: 30px 0 0 0; text-align: center;">
                          Or copy and paste this URL into your browser:<br>
                          <a href="${verificationUrl}" style="color: #999999; word-break: break-all;">${verificationUrl}</a>
                        </p>
                        <p style="color: #666666; font-size: 14px; line-height: 20px; margin: 30px 0 0 0; text-align: center; border-top: 1px solid #222222; padding-top: 30px;">
                          If you didn't create an account with Mudra, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false, error };
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Reset your password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset your password</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #000000; margin: 0; padding: 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #111111; border-radius: 12px; border: 1px solid #222222;">
                    <tr>
                      <td style="padding: 40px;">
                        <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                          Reset your password
                        </h1>
                        <p style="color: #999999; font-size: 16px; line-height: 24px; margin: 0 0 30px 0; text-align: center;">
                          We received a request to reset your password. Click the button below to create a new password.
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 20px 0;">
                              <a href="${resetUrl}" style="background-color: #ffffff; color: #000000; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                                Reset Password
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="color: #666666; font-size: 14px; line-height: 20px; margin: 30px 0 0 0; text-align: center;">
                          Or copy and paste this URL into your browser:<br>
                          <a href="${resetUrl}" style="color: #999999; word-break: break-all;">${resetUrl}</a>
                        </p>
                        <p style="color: #ff6b6b; font-size: 14px; line-height: 20px; margin: 20px 0 0 0; text-align: center;">
                          This link will expire in 1 hour.
                        </p>
                        <p style="color: #666666; font-size: 14px; line-height: 20px; margin: 30px 0 0 0; text-align: center; border-top: 1px solid #222222; padding-top: 30px;">
                          If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error };
  }
}

export async function sendWelcomeEmail(email: string, name: string) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Welcome to Mudra!',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Mudra</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #000000; margin: 0; padding: 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #111111; border-radius: 12px; border: 1px solid #222222;">
                    <tr>
                      <td style="padding: 40px;">
                        <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; text-align: center;">
                          Welcome to Mudra, ${name}!
                        </h1>
                        <p style="color: #999999; font-size: 16px; line-height: 24px; margin: 0 0 30px 0; text-align: center;">
                          You're all set! Get started by setting up your brand profile and running your first AI visibility analysis.
                        </p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 20px 0;">
                              <a href="${APP_URL}/dashboard" style="background-color: #ffffff; color: #000000; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                                Go to Dashboard
                              </a>
                            </td>
                          </tr>
                        </table>
                        <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #222222;">
                          <h2 style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 20px 0;">
                            What's next?
                          </h2>
                          <ul style="color: #999999; font-size: 14px; line-height: 24px; margin: 0; padding: 0 0 0 20px;">
                            <li style="margin-bottom: 12px;">Complete your brand profile</li>
                            <li style="margin-bottom: 12px;">Run your first AI visibility analysis</li>
                            <li style="margin-bottom: 12px;">Set up tracking for AI referral traffic</li>
                            <li>Explore optimization recommendations</li>
                          </ul>
                        </div>
                        <p style="color: #666666; font-size: 14px; line-height: 20px; margin: 30px 0 0 0; text-align: center; border-top: 1px solid #222222; padding-top: 30px;">
                          Need help? Reply to this email or visit our <a href="${APP_URL}/help" style="color: #999999;">help center</a>.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error };
  }
}
