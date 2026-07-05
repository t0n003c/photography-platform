ALTER TABLE "order" ADD COLUMN "tax_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shipping_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "store_settings_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_notify_email" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_checkout_label" text DEFAULT 'Manual invoice checkout' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_checkout_instructions" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_confirmation_message" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_tax_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_tax_rate_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_shipping_mode" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_shipping_flat_cents" integer DEFAULT 0 NOT NULL;