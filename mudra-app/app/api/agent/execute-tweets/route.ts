import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  console.log("SESSION:", session?.accessToken, session?.accessSecret);
  if (!session?.accessToken || !session?.accessSecret) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { tweet } = await req.json();

  const response = await fetch("http://localhost:8001/execute-tweets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tweets: [tweet],
      access_token: session.accessToken,
      access_token_secret: session.accessSecret,
    }),
  });
  const data = await response.json();
  return NextResponse.json(data);
}

