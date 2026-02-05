import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';

const defaultSettings = {
  email: {
    analysisComplete: true,
    weeklyReport: true,
    visibilityChanges: true,
    competitorAlerts: false,
    systemUpdates: true,
  },
  inApp: {
    analysisComplete: true,
    weeklyReport: true,
    visibilityChanges: true,
    competitorAlerts: true,
  },
  slack: {
    enabled: false,
    analysisComplete: false,
    visibilityChanges: false,
    competitorAlerts: false,
  },
};

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  return NextResponse.json({ data: defaultSettings });
}

export async function PATCH() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  // Settings are cosmetic until email/Slack integration is added
  return NextResponse.json({ ok: true });
}
