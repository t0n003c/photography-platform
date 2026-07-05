ALTER TABLE "invoice" ADD COLUMN "online_payment_provider" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "online_payment_status" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "online_payment_session_id" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "online_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "online_payment_url" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "online_payment_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_online_payments_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_payment_provider" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_payment_mode" text DEFAULT 'test' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "stripe_publishable_key" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "stripe_secret_key_enc" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "stripe_webhook_secret_enc" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "stripe_statement_descriptor" text;