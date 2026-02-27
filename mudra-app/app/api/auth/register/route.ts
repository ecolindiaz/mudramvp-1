import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis'

const registerSchema = z.object({
  username: z.string()
    .min(2, 'Username must be at least 2 characters')
    .max(50, 'Username cannot exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email cannot exceed 255 characters')
    .transform(v => v.toLowerCase().trim()),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limit registration to prevent brute-force
    const rateLimited = await applyRateLimitAsync(request, 'auth');
    if (rateLimited) return rateLimited;

    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid input', details: parsed.error.errors } },
        { status: 400 }
      )
    }

    const { username, email, password } = parsed.data

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { name: username }
        ]
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: { message: existingUser.email === email ? "Email already registered" : "Username already taken" } },
        { status: 409 }
      )
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user with provided email
    const user = await prisma.user.create({
      data: {
        email: email,
        name: username,
        password: hashedPassword,
      }
    })

    console.log("✅ User created:", { id: user.id, username: user.name })

    return NextResponse.json({
      success: true,
      userId: user.id,
      username: user.name,
      email: user.email
    })

  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { success: false, error: { message: "Failed to create account" } },
      { status: 500 }
    )
  }
  // Note: DO NOT call prisma.$disconnect() - the singleton handles connection lifecycle
}
