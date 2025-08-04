-- Migration: Add webhook subscriptions table for dashboard integrations
-- Run with: npm run db:push

CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "url" text NOT NULL,
  "events" jsonb NOT NULL,
  "secret" text,
  "is_active" boolean DEFAULT true,
  "last_triggered" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS "webhook_subscriptions_user_id_idx" ON "webhook_subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "webhook_subscriptions_is_active_idx" ON "webhook_subscriptions" ("is_active");

-- Comments for documentation
COMMENT ON TABLE "webhook_subscriptions" IS 'Webhook subscriptions for external dashboard integrations';
COMMENT ON COLUMN "webhook_subscriptions"."events" IS 'Array of event types to listen for (e.g., ["brand_analysis.completed", "chat.message"])';
COMMENT ON COLUMN "webhook_subscriptions"."secret" IS 'Secret key for webhook signature verification';
