ALTER TABLE "gallery" ADD COLUMN "video_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "gallery" ADD COLUMN "video_storage_key" text;--> statement-breakpoint
ALTER TABLE "gallery" ADD COLUMN "video_generated_at" timestamp with time zone;