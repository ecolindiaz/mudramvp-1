import { NextResponse } from "next/server";
import { getBrandProfile, saveBrandProfile } from "@/lib/prisma-brand-profile";

export async function GET() {
  const profile = await getBrandProfile();
  return NextResponse.json(profile || null);
}

export async function POST(req: Request) {
  const data = await req.json();
  const saved = await saveBrandProfile(data);
  return NextResponse.json({ success: true, profile: saved });
}
