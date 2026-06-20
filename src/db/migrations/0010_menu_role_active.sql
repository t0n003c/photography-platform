ALTER TABLE "menu" ADD COLUMN "role" text DEFAULT 'primary' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu" ADD COLUMN "is_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill: existing rows are keyed by role ("primary"/"footer") and are the
-- live menus, so derive role from key and mark them active.
UPDATE "menu" SET "role" = "key" WHERE "key" IN ('primary', 'footer');--> statement-breakpoint
UPDATE "menu" SET "is_active" = true;