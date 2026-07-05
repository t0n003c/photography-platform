ALTER TABLE "invoice" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "payment_instructions" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "public_token_hash" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_public_token_hash_unique" UNIQUE("public_token_hash");