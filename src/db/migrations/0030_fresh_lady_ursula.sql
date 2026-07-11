CREATE TABLE "security_event" (
	"id" text PRIMARY KEY NOT NULL,
	"surface" text NOT NULL,
	"action" text NOT NULL,
	"outcome" text DEFAULT 'unknown' NOT NULL,
	"ip_address" text,
	"country" text,
	"user_agent" text,
	"browser" text,
	"os" text,
	"device" text,
	"referrer" text,
	"source" text,
	"path" text,
	"email" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "security_event_created_idx" ON "security_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "security_event_surface_idx" ON "security_event" USING btree ("surface","outcome");--> statement-breakpoint
CREATE INDEX "security_event_ip_idx" ON "security_event" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "security_event_source_idx" ON "security_event" USING btree ("source");