import { NextRequest, NextResponse } from "next/server"
import { Resend } from 'resend'

const resendApiKey = process.env.RESEND_API_KEY
const resend = resendApiKey ? new Resend(resendApiKey) : null

export async function POST(request: NextRequest) {
  try {
    const { email, username, password } = await request.json()

    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Email, username, and password are required" },
        { status: 400 }
      )
    }

    // Check if Resend is configured
    if (!resend || !resendApiKey) {
      console.warn("⚠️ RESEND_API_KEY not configured - email sending disabled")
      console.log("📋 Credentials created (email not sent) for:", email)
      
      return NextResponse.json({
        success: true,
        message: "Account created (email sending disabled - RESEND_API_KEY not configured)",
        warning: "Email was not sent. Please configure RESEND_API_KEY environment variable."
      })
    }

    console.log("📧 Sending credentials email to:", email)
    console.log("📧 Username:", username)

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'Mudra <onboarding@resend.dev>', // Use your verified domain or resend.dev for testing
      to: [email],
      subject: 'Your Mudra Beta Account Credentials',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Mudra Beta! 🎉</h2>
          <p style="color: #666; font-size: 16px;">Your account has been created successfully. Here are your login credentials:</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0; color: #333;"><strong>Username:</strong> ${username}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Password:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 3px;">${password}</code></p>
          </div>
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;"><strong>⚠️ Important:</strong> Please save these credentials in a secure location.</p>
          </div>
          <p style="color: #666;">You can log in at: <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}" style="color: #007bff;">${process.env.NEXTAUTH_URL || 'http://localhost:3000'}</a></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 14px;">Best regards,<br/>The Mudra Team</p>
        </div>
      `,
      text: `
Welcome to Mudra Beta!

Your account has been created successfully. Here are your login credentials:

Username: ${username}
Password: ${password}

⚠️ Important: Please save these credentials in a secure location.

You can log in at: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}

Best regards,
The Mudra Team
      `
    })

    if (error) {
      console.error("❌ Resend error:", error)
      throw new Error(error.message)
    }

    console.log("✅ Email sent successfully via Resend:", data)

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      emailId: data?.id
    })

  } catch (error: any) {
    console.error("Email sending error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    )
  }
}
