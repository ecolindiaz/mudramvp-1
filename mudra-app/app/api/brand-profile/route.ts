import { NextRequest, NextResponse } from "next/server";
import { getBrandProfileByUserId, saveBrandProfileForUser } from "@/lib/prisma-brand-profile";
import { requireAuth } from "@/lib/auth/require-auth";
import { applyRateLimitAsync } from "@/lib/auth/rate-limiter-redis";
import { logBrandProfileChange } from "@/lib/services/audit-log.service";

const REQUEST_TIMEOUT_MS = Number.parseInt(
  (
    (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.BRAND_PROFILE_REQUEST_TIMEOUT_MS ?? "5000"
  ),
  10,
);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutLabel: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const timeoutError = new Error(`${timeoutLabel} timed out after ${timeoutMs}ms`);
      timeoutError.name = "TimeoutError";
      reject(timeoutError);
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimited = await applyRateLimitAsync(request, 'standard');
  if (rateLimited) return rateLimited;

  try {
    // Require authentication
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const profile = await withTimeout(
      getBrandProfileByUserId(authResult.user.id),
      REQUEST_TIMEOUT_MS,
      "getBrandProfile",
    );
    if (!profile) {
      return NextResponse.json(null);
    }

    return NextResponse.json(profile || null);
  } catch (error: any) {
    if (error?.name === "TimeoutError") {
      console.warn("⚠️ [API /brand-profile GET] Timed out, returning fallback", error.message);
      return NextResponse.json(null, {
        headers: {
          "x-mudra-fallback": "brand-profile-timeout",
        },
      });
    }

    console.error("🔴 [API /brand-profile GET] Error:", error);
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to fetch brand profile" } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimited = await applyRateLimitAsync(req, 'standard');
  if (rateLimited) return rateLimited;

  try {
    // Require authentication
    const authResult = await requireAuth();
    if (!authResult.success) {
      return authResult.response;
    }

    const data = await req.json();
    console.log("🟡 [API /brand-profile POST] Received data for user:", authResult.user.id);
    
    const saved = await withTimeout(
      saveBrandProfileForUser(authResult.user.id, data),
      REQUEST_TIMEOUT_MS,
      "saveBrandProfile",
    );
    console.log("🟢 [API /brand-profile POST] Successfully saved profile:", saved.id);
    
    // Audit log: Brand profile updated
    await logBrandProfileChange(
      'BRAND_PROFILE_UPDATED',
      authResult.user.id,
      saved.id,
      { fields: Object.keys(data) }
    );
    
    return NextResponse.json({ success: true, profile: saved });
  } catch (error: any) {
    if (error?.name === "TimeoutError") {
      console.warn("⚠️ [API /brand-profile POST] Timed out while saving profile", error.message);
      return NextResponse.json(
        { success: false, error: { message: "Brand profile save timed out. Please retry." } },
        { status: 504 }
      );
    }

    console.error("🔴 [API /brand-profile POST] Error:", error);
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to save brand profile" } },
      { status: 500 }
    );
  }
}
