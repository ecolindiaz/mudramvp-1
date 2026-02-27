import { NextRequest, NextResponse } from "next/server"
import { Resend } from 'resend'
import { z } from 'zod'
import crypto from 'crypto'

const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

const sendCredentialsSchema = z.object({
  email: z.string().email(),
  username: z.string().min(1).max(100),
})

/**
 * Admin-only endpoint to send welcome emails.
 * Requires x-admin-token header matching ADMIN_API_TOKEN env var.
 * Never sends plaintext passwords — directs users to reset flow instead.
 */
function isAdmin(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token') || ''
  const adminToken = process.env.ADMIN_API_TOKEN
  if (!token || !adminToken) return false
  // Timing-safe comparison — hash first to ensure equal buffer lengths
  const hashA = crypto.createHash('sha256').update(token).digest()
  const hashB = crypto.createHash('sha256').update(adminToken).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    if (!isAdmin(request)) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized — admin token required" } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = sendCredentialsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid input", details: parsed.error.errors } },
        { status: 400 }
      )
    }

    const { email, username } = parsed.data
    const loginUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    // Check if Resend is configured
    if (!resend || !resendApiKey) {
      console.warn("⚠️ RESEND_API_KEY not configured - email sending disabled")
      return NextResponse.json({
        success: true,
        message: "Account created (email sending disabled - RESEND_API_KEY not configured)",
        warning: "Email was not sent. Please configure RESEND_API_KEY environment variable."
      })
    }

    // Send welcome email WITHOUT the password — direct to login/reset instead
    const { data, error } = await resend.emails.send({
      from: 'Mudra <onboarding@resend.dev>',
      to: [email],
      subject: 'Your Mudra Beta Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Mudra Beta! 🎉</h2>
          <p style="color: #666; font-size: 16px;">Your account has been created successfully.</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0; color: #333;"><strong>Username:</strong> ${username}</p>
          </div>
          <p style="color: #666;">Log in at: <a href="${loginUrl}" style="color: #007bff;">${loginUrl}</a></p>
          <p style="color: #666;">If you need to set your password, use the "Forgot Password" link on the login page.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 14px;">Best regards,<br/>The Mudra Team</p>
        </div>
      `,
      text: `Welcome to Mudra Beta!\n\nYour account has been created.\n\nUsername: ${username}\n\nLog in at: ${loginUrl}\n\nIf you need to set your password, use the "Forgot Password" link.\n\nBest regards,\nThe Mudra Team`
    })

    if (error) {
      console.error("❌ Resend error:", error)
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      message: "Welcome email sent successfully",
      emailId: data?.id
    })

  } catch (error) {
    console.error("Email sending error:", error)
    return NextResponse.json(
      { success: false, error: { message: "Failed to send email" } },
      { status: 500 }
    )
  }
}
