ALTER TABLE "order" ADD COLUMN "fulfillment_status" text DEFAULT 'unfulfilled' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "fulfillment_carrier" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "fulfillment_tracking_number" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "fulfillment_tracking_url" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "fulfillment_ready_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "fulfillment_shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "fulfillment_delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "fulfillment_notes" text;