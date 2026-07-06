ALTER TABLE "order" ADD COLUMN "discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "promo_code" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shipping_profile_id" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shipping_profile_label" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_shipping_profiles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_promo_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;