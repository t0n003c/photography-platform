CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"publicKey" text NOT NULL,
	"userId" text NOT NULL,
	"credentialID" text NOT NULL,
	"counter" integer NOT NULL,
	"deviceType" text NOT NULL,
	"backedUp" boolean NOT NULL,
	"transports" text,
	"aaguid" text,
	"createdAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"impersonatedBy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "twoFactor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backupCodes" text NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"twoFactorEnabled" boolean,
	"role" text DEFAULT 'staff',
	"banned" boolean DEFAULT false,
	"banReason" text,
	"banExpires" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"phone" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'category' NOT NULL,
	"cover_photo_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"page_config_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collection_photo" (
	"collection_id" text NOT NULL,
	"photo_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_photo_collection_id_photo_id_pk" PRIMARY KEY("collection_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "contact_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" text,
	"message" text NOT NULL,
	"spam_score" real,
	"spam_verdict" text DEFAULT 'unknown' NOT NULL,
	"spam_signals" jsonb,
	"status" text DEFAULT 'new' NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"handled_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "download" (
	"id" text PRIMARY KEY NOT NULL,
	"grant_id" text,
	"gallery_id" text,
	"client_id" text,
	"photo_id" text,
	"kind" text NOT NULL,
	"variant" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"job_id" text,
	"result_storage_key" text,
	"byte_size" bigint,
	"ip_address" text,
	"user_agent" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite" (
	"id" text PRIMARY KEY NOT NULL,
	"grant_id" text NOT NULL,
	"gallery_id" text NOT NULL,
	"client_id" text,
	"photo_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"owner_id" text NOT NULL,
	"cover_photo_id" text,
	"page_config_id" text,
	"client_id" text,
	"expires_at" timestamp with time zone,
	"password_hash" text,
	"download_enabled" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "gallery_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gallery_access_grant" (
	"id" text PRIMARY KEY NOT NULL,
	"gallery_id" text NOT NULL,
	"client_id" text,
	"token_hash" text NOT NULL,
	"label" text,
	"can_view" boolean DEFAULT true NOT NULL,
	"can_favorite" boolean DEFAULT true NOT NULL,
	"can_download" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone,
	"access_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_access_grant_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "gallery_photo" (
	"gallery_id" text NOT NULL,
	"photo_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gallery_photo_gallery_id_photo_id_pk" PRIMARY KEY("gallery_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"pdf_storage_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "invoice_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "layout" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"schema" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "layout_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "location" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"lat" double precision,
	"lng" double precision,
	"cover_photo_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "location_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"email" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"payment_provider" text,
	"payment_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text,
	"photo_id" text,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer DEFAULT 0 NOT NULL,
	"line_total_cents" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_config" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"layout_id" text,
	"grid_type" text,
	"spacing" text,
	"theme" text,
	"hero" jsonb,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"original_storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"capture_date" timestamp with time zone,
	"dominant_color" text,
	"lqip" text,
	"blurhash" text,
	"alt_text" text,
	"exif" jsonb,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "photo_location" (
	"location_id" text NOT NULL,
	"photo_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "photo_location_location_id_photo_id_pk" PRIMARY KEY("location_id","photo_id")
);
--> statement-breakpoint
CREATE TABLE "photo_variant" (
	"id" text PRIMARY KEY NOT NULL,
	"photo_id" text NOT NULL,
	"format" text NOT NULL,
	"size_bucket" text NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" text NOT NULL,
	"photo_id" text,
	"base_price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_cover_photo_id_photo_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_photo" ADD CONSTRAINT "collection_photo_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_photo" ADD CONSTRAINT "collection_photo_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_submission" ADD CONSTRAINT "contact_submission_handled_by_user_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download" ADD CONSTRAINT "download_grant_id_gallery_access_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."gallery_access_grant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download" ADD CONSTRAINT "download_gallery_id_gallery_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."gallery"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download" ADD CONSTRAINT "download_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download" ADD CONSTRAINT "download_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_grant_id_gallery_access_grant_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."gallery_access_grant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_gallery_id_gallery_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."gallery"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery" ADD CONSTRAINT "gallery_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery" ADD CONSTRAINT "gallery_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_access_grant" ADD CONSTRAINT "gallery_access_grant_gallery_id_gallery_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."gallery"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_access_grant" ADD CONSTRAINT "gallery_access_grant_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_access_grant" ADD CONSTRAINT "gallery_access_grant_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photo" ADD CONSTRAINT "gallery_photo_gallery_id_gallery_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."gallery"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_photo" ADD CONSTRAINT "gallery_photo_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_cover_photo_id_photo_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_config" ADD CONSTRAINT "page_config_layout_id_layout_id_fk" FOREIGN KEY ("layout_id") REFERENCES "public"."layout"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_location" ADD CONSTRAINT "photo_location_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_location" ADD CONSTRAINT "photo_location_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_variant" ADD CONSTRAINT "photo_variant_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "client_created_by_idx" ON "client" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "client_email_active_uniq" ON "client" USING btree (lower("email")) WHERE "client"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "collection_photo_order_idx" ON "collection_photo" USING btree ("collection_id","sort_order");--> statement-breakpoint
CREATE INDEX "collection_photo_photo_idx" ON "collection_photo" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "contact_status_idx" ON "contact_submission" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_created_idx" ON "contact_submission" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contact_verdict_idx" ON "contact_submission" USING btree ("spam_verdict");--> statement-breakpoint
CREATE INDEX "download_grant_idx" ON "download" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "download_gallery_idx" ON "download" USING btree ("gallery_id");--> statement-breakpoint
CREATE INDEX "download_status_idx" ON "download" USING btree ("status");--> statement-breakpoint
CREATE INDEX "download_created_idx" ON "download" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_unique" ON "favorite" USING btree ("grant_id","photo_id");--> statement-breakpoint
CREATE INDEX "favorite_gallery_idx" ON "favorite" USING btree ("gallery_id");--> statement-breakpoint
CREATE INDEX "favorite_photo_idx" ON "favorite" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "gallery_owner_idx" ON "gallery" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "gallery_client_idx" ON "gallery" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "gallery_public_listing_idx" ON "gallery" USING btree ("visibility","status") WHERE "gallery"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "grant_gallery_idx" ON "gallery_access_grant" USING btree ("gallery_id");--> statement-breakpoint
CREATE INDEX "grant_client_idx" ON "gallery_access_grant" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "grant_active_idx" ON "gallery_access_grant" USING btree ("gallery_id") WHERE "gallery_access_grant"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "gallery_photo_order_idx" ON "gallery_photo" USING btree ("gallery_id","sort_order");--> statement-breakpoint
CREATE INDEX "gallery_photo_photo_idx" ON "gallery_photo" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "page_config_scope_idx" ON "page_config" USING btree ("scope");--> statement-breakpoint
CREATE UNIQUE INDEX "page_config_default_uniq" ON "page_config" USING btree ("scope") WHERE "page_config"."is_default";--> statement-breakpoint
CREATE INDEX "photo_owner_idx" ON "photo" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "photo_status_idx" ON "photo" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "photo_capture_idx" ON "photo" USING btree ("capture_date");--> statement-breakpoint
CREATE INDEX "photo_active_idx" ON "photo" USING btree ("created_at") WHERE "photo"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "photo_location_order_idx" ON "photo_location" USING btree ("location_id","sort_order");--> statement-breakpoint
CREATE INDEX "photo_location_photo_idx" ON "photo_location" USING btree ("photo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_unique" ON "photo_variant" USING btree ("photo_id","format","size_bucket");--> statement-breakpoint
CREATE INDEX "variant_photo_idx" ON "photo_variant" USING btree ("photo_id");