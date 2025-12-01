import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth"
import { NextRequest } from "next/server"

export async function getSession() {
  return await getServerSession(authOptions)
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user
}

export async function requireAuth() {
  const session = await getSession()
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  
  return session.user
}

export function requireAuthHeader(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error("Unauthorized")
  }
  
  // For API key validation (optional)
  const apiKey = authHeader.substring(7)
  
  if (process.env.NODE_ENV === 'production' && !apiKey) {
    throw new Error("Unauthorized")
  }
  
  return apiKey
}
