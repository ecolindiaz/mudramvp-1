import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const url = new URL(req.url);
    const siteId = url.searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json({ success: false, error: { message: "siteId is required", code: "MISSING_PARAMETER" } }, { status: 400 });
    }

    // Verify the user owns a brand profile linked to this site
    const brandProfile = await prisma.brandProfile.findFirst({
      where: { siteId, userId: authResult.user.id },
      select: { id: true }
    });

    if (!brandProfile) {
      return NextResponse.json({ success: false, error: { message: "Site not found", code: "NOT_FOUND" } }, { status: 404 });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { companyId: true }
    });

    if (!site) {
      return NextResponse.json({ success: false, error: { message: "Site not found", code: "NOT_FOUND" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { companyId: site.companyId } });
  } catch (err) {
    return NextResponse.json({ success: false, error: { message: (err as Error).message } }, { status: 500 });
  }
}
