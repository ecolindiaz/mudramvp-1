import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/analysis/technical/repo";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json({ success: false, error: { message: "siteId is required" } }, { status: 400 });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { companyId: true }
    });

    if (!site) {
      return NextResponse.json({ success: false, error: { message: "Site not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { companyId: site.companyId } });
  } catch (err) {
    return NextResponse.json({ success: false, error: { message: (err as Error).message } }, { status: 500 });
  }
}
