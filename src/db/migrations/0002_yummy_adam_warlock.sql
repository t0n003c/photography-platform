CREATE TABLE "folder" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"cover_photo_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folder_photo" (
	"folder_id" text NOT NULL,
	"photo_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "folder_photo_folder_id_photo_id_pk" PRIMARY KEY("folder_id","photo_id")
);
--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_parent_id_folder_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_cover_photo_id_photo_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_photo" ADD CONSTRAINT "folder_photo_folder_id_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_photo" ADD CONSTRAINT "folder_photo_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folder_parent_idx" ON "folder" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "folder_photo_order_idx" ON "folder_photo" USING btree ("folder_id","sort_order");--> statement-breakpoint
CREATE INDEX "folder_photo_photo_idx" ON "folder_photo" USING btree ("photo_id");