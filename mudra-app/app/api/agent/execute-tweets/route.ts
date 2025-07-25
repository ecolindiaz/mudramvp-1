// Tweet Execution Layer (Next.js API route)
// This route receives tweets and user tokens, calls the Python agent, and returns the result.

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { tweets, bearer_token } = await req.json()
  // Call the Python agent (assume running on localhost:8001)
  const response = await fetch("http://localhost:8001/execute-tweets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tweets, bearer_token })
  })
  const data = await response.json()
  return NextResponse.json(data)
}
