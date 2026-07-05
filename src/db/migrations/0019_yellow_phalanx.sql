CREATE TABLE "stripe_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"livemode" boolean,
	"api_version" text,
	"invoice_id" text,
	"session_id" text,
	"payment_intent_id" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_webhook_event" ADD CONSTRAINT "stripe_webhook_event_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stripe_webhook_event_status_idx" ON "stripe_webhook_event" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stripe_webhook_event_invoice_idx" ON "stripe_webhook_event" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_event_session_idx" ON "stripe_webhook_event" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_event_received_idx" ON "stripe_webhook_event" USING btree ("received_at");