/**
 * Analytics Event Service
 * 
 * Handles tracking events from embedded tracking codes.
 * Detects AI referral traffic and stores events for analysis.
 */

import { prisma } from '@/lib/prisma';

export interface AnalyticsEventData {
  trackingId: string;
  eventType: 'page_view' | 'click' | 'conversion';
  pageUrl: string;
  pageTitle?: string;
  referrer?: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

const AI_PLATFORMS = {
  'chatgpt.com': 'chatgpt',
  'perplexity.ai': 'perplexity',
  'gemini.google.com': 'gemini',
  'claude.ai': 'claude'
} as const;

/**
 * Detect AI platform from referrer URL
 */
export function detectAIPlatform(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  
  const refLower = referrer.toLowerCase();
  
  for (const [domain, platform] of Object.entries(AI_PLATFORMS)) {
    if (refLower.includes(domain)) {
      return platform;
    }
  }
  
  return null;
}

/**
 * Track analytics event
 */
export async function trackEvent(eventData: AnalyticsEventData): Promise<void> {
  // Get tracking code
  const trackingCode = await prisma.trackingCode.findUnique({
    where: { trackingId: eventData.trackingId }
  });

  if (!trackingCode || !trackingCode.isActive) {
    throw new Error('Invalid or inactive tracking code');
  }

  // Detect AI platform
  const aiPlatform = detectAIPlatform(eventData.referrer);
  const isAIReferral = !!aiPlatform;

  // Create event
  await prisma.analyticsEvent.create({
    data: {
      trackingCodeId: trackingCode.id,
      trackingId: eventData.trackingId,
      brandProfileId: trackingCode.brandProfileId,
      eventType: eventData.eventType,
      pageUrl: eventData.pageUrl,
      pageTitle: eventData.pageTitle,
      referrer: eventData.referrer,
      isAIReferral,
      aiPlatform,
      userAgent: eventData.userAgent,
      ipAddress: eventData.ipAddress,
      sessionId: eventData.sessionId,
      metadata: eventData.metadata as any
    }
  });

  // Update tracking code stats
  await prisma.trackingCode.update({
    where: { id: trackingCode.id },
    data: {
      totalEvents: { increment: 1 },
      totalAIReferrals: { increment: isAIReferral ? 1 : 0 },
      lastEventAt: new Date()
    }
  });

  // Update monthly metrics (fire and forget)
  updateMonthlyMetrics(trackingCode.brandProfileId, aiPlatform).catch(console.error);
}

/**
 * Update monthly AI referral metrics
 */
async function updateMonthlyMetrics(brandProfileId: number, aiPlatform: string | null): Promise<void> {
  if (!aiPlatform) return;

  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get or create monthly metrics
  const metrics = await prisma.aIReferralMetrics.upsert({
    where: {
      brandProfileId_month: {
        brandProfileId,
        month
      }
    },
    create: {
      brandProfileId,
      month,
      totalVisits: 1,
      chatgptVisits: aiPlatform === 'chatgpt' ? 1 : 0,
      perplexityVisits: aiPlatform === 'perplexity' ? 1 : 0,
      geminiVisits: aiPlatform === 'gemini' ? 1 : 0,
      claudeVisits: aiPlatform === 'claude' ? 1 : 0,
      otherAIVisits: !['chatgpt', 'perplexity', 'gemini', 'claude'].includes(aiPlatform) ? 1 : 0
    },
    update: {
      totalVisits: { increment: 1 },
      chatgptVisits: { increment: aiPlatform === 'chatgpt' ? 1 : 0 },
      perplexityVisits: { increment: aiPlatform === 'perplexity' ? 1 : 0 },
      geminiVisits: { increment: aiPlatform === 'gemini' ? 1 : 0 },
      claudeVisits: { increment: aiPlatform === 'claude' ? 1 : 0 },
      otherAIVisits: { increment: !['chatgpt', 'perplexity', 'gemini', 'claude'].includes(aiPlatform) ? 1 : 0 }
    }
  });
}

/**
 * Get AI referral stats for brand profile
 */
export async function getAIReferralStats(brandProfileId: number, startDate?: Date, endDate?: Date) {
  const where: any = {
    brandProfileId,
    isAIReferral: true
  };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [total, byPlatform] = await Promise.all([
    // Total AI referrals
    prisma.analyticsEvent.count({ where }),
    
    // Group by platform
    prisma.analyticsEvent.groupBy({
      by: ['aiPlatform'],
      where,
      _count: {
        id: true
      }
    })
  ]);

  return {
    total,
    byPlatform: byPlatform.reduce((acc, item) => {
      if (item.aiPlatform) {
        acc[item.aiPlatform] = item._count.id;
      }
      return acc;
    }, {} as Record<string, number>)
  };
}

/**
 * Get monthly AI referral metrics with month-over-month comparison
 */
export async function getMonthlyMetricsWithDelta(brandProfileId: number) {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [current, previous] = await Promise.all([
    prisma.aIReferralMetrics.findUnique({
      where: {
        brandProfileId_month: {
          brandProfileId,
          month: currentMonth
        }
      }
    }),
    prisma.aIReferralMetrics.findUnique({
      where: {
        brandProfileId_month: {
          brandProfileId,
          month: previousMonth
        }
      }
    })
  ]);

  const currentTotal = current?.totalVisits || 0;
  const previousTotal = previous?.totalVisits || 0;
  
  const delta = previousTotal > 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : currentTotal > 0 ? 100 : 0;

  return {
    current: {
      totalVisits: currentTotal,
      chatgptVisits: current?.chatgptVisits || 0,
      perplexityVisits: current?.perplexityVisits || 0,
      geminiVisits: current?.geminiVisits || 0,
      claudeVisits: current?.claudeVisits || 0,
      otherAIVisits: current?.otherAIVisits || 0,
      month: currentMonth
    },
    previous: {
      totalVisits: previousTotal,
      month: previousMonth
    },
    delta: {
      value: delta,
      isPositive: delta >= 0,
      percentage: Math.abs(delta).toFixed(1)
    }
  };
}
