ALTER TABLE "product" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "product"
SET "slug" = lower(
  regexp_replace(
    trim(both '-' from regexp_replace(coalesce(nullif("sku", ''), "name", "id"), '[^a-zA-Z0-9]+', '-', 'g')),
    '-+',
    '-',
    'g'
  )
) || '-' || substr("id", 1, 6)
WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "product" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "sale_price_cents" integer;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_slug_unique" UNIQUE("slug");
