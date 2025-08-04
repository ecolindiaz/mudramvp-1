import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { webhookSubscriptions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { handleApiError, AuthenticationError, ValidationError } from '@/lib/api-errors';

// POST /api/webhooks/subscribe - Subscribe to Fire SaaS Geo events
export async function POST(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to manage webhooks');
    }

    const { url, events, secret } = await request.json();

    if (!url || !events || !Array.isArray(events)) {
      throw new ValidationError('Invalid webhook configuration', {
        url: !url ? 'Webhook URL is required' : '',
        events: !events || !Array.isArray(events) ? 'Events array is required' : '',
      });
    }

    // Supported events
    const supportedEvents = [
      'brand_analysis.completed',
      'brand_analysis.failed', 
      'chat.message',
      'credits.depleted',
      'user.registered'
    ];

    const invalidEvents = events.filter(event => !supportedEvents.includes(event));
    if (invalidEvents.length > 0) {
      throw new ValidationError('Invalid events', {
        events: `Unsupported events: ${invalidEvents.join(', ')}`
      });
    }

    const [subscription] = await db.insert(webhookSubscriptions).values({
      userId: sessionResponse.user.id,
      url,
      events,
      secret,
      isActive: true,
    }).returning();

    return NextResponse.json(subscription);
  } catch (error) {
    return handleApiError(error);
  }
}

// GET /api/webhooks/subscribe - Get user's webhook subscriptions
export async function GET(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to view webhooks');
    }

    const subscriptions = await db.query.webhookSubscriptions.findMany({
      where: eq(webhookSubscriptions.userId, sessionResponse.user.id),
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    return handleApiError(error);
  }
}
