import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { applyRateLimitAsync } from '@/lib/auth/rate-limiter-redis';

interface FiregeoWebhookEvent {
  id: string;
  event: string;
  timestamp: string;
  data: any;
}

export async function POST(request: NextRequest) {
  // Apply rate limiting to webhooks
  const rateLimited = await applyRateLimitAsync(request, 'webhook');
  if (rateLimited) return rateLimited;

  try {
    const signature = request.headers.get('x-fire-signature-256');
    const payload = await request.text();
    
    // SECURITY: Require webhook secret in production
    const webhookSecret = process.env.FIREGEO_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook] FIREGEO_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    // SECURITY: Require valid signature
    if (!signature) {
      console.error('[Webhook] Missing signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    if (signature !== `sha256=${expectedSignature}`) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event: FiregeoWebhookEvent = JSON.parse(payload);
    console.log('Received Firegeo webhook:', event.event);

    // Handle different event types
    switch (event.event) {
      case 'brand_analysis.completed':
        await handleBrandAnalysisCompleted(event.data);
        break;

      case 'chat.message':
        await handleChatMessage(event.data);
        break;

      case 'credits.low':
        await handleLowCredits(event.data);
        break;

      default:
        console.log('Unknown event type:', event.event);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing Firegeo webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleBrandAnalysisCompleted(data: any) {
  console.log('Brand analysis completed:', data);
  
  // Here you could:
  // 1. Store the analysis data in your database
  // 2. Send notifications to users
  // 3. Trigger real-time updates via WebSocket/SSE
  // 4. Update caches
  
  // Example: Store in database (implement based on your schema)
  // await prisma.brandAnalysis.create({
  //   data: {
  //     analysisId: data.analysisId,
  //     companyName: data.companyName,
  //     visibilityScore: data.visibilityScore,
  //     // ... other fields
  //   }
  // });
}

async function handleChatMessage(data: any) {
  console.log('Chat message received:', data);
  
  // Track chat usage metrics
  // Update conversation logs
  // Monitor for specific topics or patterns
}

async function handleLowCredits(data: any) {
  console.log('Low credits alert:', data);
  
  // Send alert to administrators
  // Trigger billing notifications
  // Implement auto-scaling if needed
  
  if (data.remainingCredits <= 5) {
    console.warn('CRITICAL: Very low credits remaining:', data.remainingCredits);
    // Send urgent notifications
  }
}
