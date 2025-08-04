import { db } from '@/lib/db';
import { webhookSubscriptions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export interface WebhookEvent {
  type: string;
  data: any;
  timestamp: string;
  userId: string;
}

export async function triggerWebhooks(event: WebhookEvent) {
  try {
    // Get all active webhook subscriptions for this user that listen to this event type
    const subscriptions = await db.query.webhookSubscriptions.findMany({
      where: and(
        eq(webhookSubscriptions.userId, event.userId),
        eq(webhookSubscriptions.isActive, true)
      ),
    });

    const relevantSubscriptions = subscriptions.filter(sub => {
      const events = Array.isArray(sub.events) ? sub.events : [];
      return events.includes(event.type);
    });

    console.log(`Triggering ${relevantSubscriptions.length} webhooks for event ${event.type}`);

    // Send webhooks in parallel
    const webhookPromises = relevantSubscriptions.map(async (subscription) => {
      try {
        const payload = {
          id: crypto.randomUUID(),
          event: event.type,
          timestamp: event.timestamp,
          data: event.data,
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'Fire-SaaS-Geo/1.0',
          'X-Fire-Event-Type': event.type,
          'X-Fire-Delivery': crypto.randomUUID(),
        };

        // Add signature if secret is provided
        if (subscription.secret) {
          const signature = crypto
            .createHmac('sha256', subscription.secret)
            .update(JSON.stringify(payload))
            .digest('hex');
          headers['X-Fire-Signature-256'] = `sha256=${signature}`;
        }

        const response = await fetch(subscription.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        // Update last triggered timestamp
        await db.update(webhookSubscriptions)
          .set({ lastTriggered: new Date() })
          .where(eq(webhookSubscriptions.id, subscription.id));

        if (!response.ok) {
          console.error(`Webhook failed for ${subscription.url}: ${response.status} ${response.statusText}`);
        } else {
          console.log(`Webhook delivered successfully to ${subscription.url}`);
        }

        return { success: true, subscription: subscription.id };
      } catch (error) {
        console.error(`Webhook error for ${subscription.url}:`, error);
        return { success: false, subscription: subscription.id, error };
      }
    });

    const results = await Promise.allSettled(webhookPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    console.log(`Webhook delivery complete: ${successful}/${relevantSubscriptions.length} successful`);
    
    return {
      total: relevantSubscriptions.length,
      successful,
      failed: relevantSubscriptions.length - successful,
    };
  } catch (error) {
    console.error('Failed to trigger webhooks:', error);
    return { total: 0, successful: 0, failed: 0 };
  }
}

// Helper function to create standard webhook events
export const createWebhookEvent = {
  brandAnalysisCompleted: (userId: string, analysis: any): WebhookEvent => ({
    type: 'brand_analysis.completed',
    userId,
    timestamp: new Date().toISOString(),
    data: {
      analysisId: analysis.id,
      companyName: analysis.companyName,
      industry: analysis.industry,
      url: analysis.url,
      visibilityScore: analysis.analysisData?.competitors?.find((c: any) => c.isOwn)?.visibilityScore,
      competitorCount: analysis.analysisData?.competitors?.length || 0,
      creditsUsed: analysis.creditsUsed,
      createdAt: analysis.createdAt,
    },
  }),

  chatMessage: (userId: string, message: any, conversation: any): WebhookEvent => ({
    type: 'chat.message',
    userId,
    timestamp: new Date().toISOString(),
    data: {
      messageId: message.id,
      conversationId: conversation.id,
      role: message.role,
      tokenCount: message.tokenCount,
      createdAt: message.createdAt,
    },
  }),

  creditsLow: (userId: string, remainingCredits: number): WebhookEvent => ({
    type: 'credits.low',
    userId,
    timestamp: new Date().toISOString(),
    data: {
      remainingCredits,
      threshold: 10, // Alert when below 10 credits
    },
  }),
};
