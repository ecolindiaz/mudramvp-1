// app/api/execute-tweet/route.ts (or pages/api/execute-tweet.ts for Pages Router)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // Adjust the import path as necessary

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken || !session?.accessSecret) {
    return NextResponse.json(
      { error: "Missing access token or secret." },
      { status: 400 }
    );
  }

  const { tweet } = await req.json();

  const res = await fetch("http://localhost:8001/execute-tweets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tweets: [tweet],
      access_token: session.accessToken,
      access_token_secret: session.accessSecret,
    }),
  });

  const json = await res.json();
  return NextResponse.json(json);
}
