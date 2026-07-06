ALTER TABLE "order_item" ADD COLUMN "stripe_tax_code" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "stripe_tax_code" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "store_stripe_shipping_tax_code" text;