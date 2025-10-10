import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: username },
          { name: username }
        ]
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      )
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user with username as email (for NextAuth compatibility)
    const user = await prisma.user.create({
      data: {
        email: `${username}@mudra.app`, // Use username as email
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

  } catch (error: any) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
