ALTER TABLE "order_item" ADD COLUMN "options" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "options" jsonb DEFAULT '[]'::jsonb NOT NULL;