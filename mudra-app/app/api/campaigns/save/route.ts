/**
 * @deprecated Campaign model does not exist in Prisma schema.
 * This route is stubbed out to prevent build errors.
 * TODO: Add Campaign model to schema or remove this route.
 */
import { NextRequest, NextResponse } from "next/server";

const FEATURE_UNAVAILABLE = {
  success: false,
  error: "Campaigns feature is not yet available. The Campaign model has not been added to the database schema.",
};

export async function POST(req: NextRequest) {
  return NextResponse.json(FEATURE_UNAVAILABLE, { status: 501 });
}

export async function GET(req: NextRequest) {
  // Return empty campaigns list for UI compatibility
  return NextResponse.json({ success: true, campaigns: [] });
}

