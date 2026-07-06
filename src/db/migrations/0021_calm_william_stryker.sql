CREATE TABLE "order_refund" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"invoice_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'succeeded' NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_refund_id" text,
	"method" text,
	"reference" text,
	"reason" text,
	"note" text,
	"refunded_at" timestamp with time zone,
	"receipt_sent_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_refund" ADD CONSTRAINT "order_refund_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_refund" ADD CONSTRAINT "order_refund_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_refund" ADD CONSTRAINT "order_refund_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_refund_order_idx" ON "order_refund" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_refund_invoice_idx" ON "order_refund" USING btree ("invoice_id");