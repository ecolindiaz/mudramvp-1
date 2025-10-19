import { NextResponse } from "next/server";
import { getBrandProfile, saveBrandProfile } from "@/lib/prisma-brand-profile";

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

export async function GET() {
  try {
    const profile = await withTimeout(
      getBrandProfile(),
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

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log("🟡 [API /brand-profile POST] Received data:", data);
    
    const saved = await withTimeout(
      saveBrandProfile(data),
      REQUEST_TIMEOUT_MS,
      "saveBrandProfile",
    );
    console.log("🟢 [API /brand-profile POST] Successfully saved profile:", saved.id);
    
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
