ALTER TABLE "invoice" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "paid_amount_cents" integer;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "payment_reference" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "payment_note" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "receipt_sent_at" timestamp with time zone;