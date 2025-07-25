// Next.js API route to execute a tweet via Python FastAPI
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Accepts: { tweet }
  const { tweet } = await req.json();
  // Hardcoded bearer token for testing
  const bearer_token = "YOUR_BEARER_TOKEN_HERE";
  // Forward to Python FastAPI
  const res = await fetch("http://localhost:8001/execute-tweets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tweets: [tweet],
      bearer_token
    })
  });
  const json = await res.json();
  return NextResponse.json(json);
}
