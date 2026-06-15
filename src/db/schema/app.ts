import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  doublePrecision,
  real,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

// Application tables (DATA-MODEL §4–§15). Drizzle is the source of truth.
// Conventions: text ULID PKs, timestamptz, money in integer cents, enums typed
// at the TS layer via the `enum` option. snake_case columns.

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ── §4 Clients ───────────────────────────────────────────────────────────────
export const client = pgTable(
  "client",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    phone: text("phone"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("client_created_by_idx").on(t.createdBy),
    uniqueIndex("client_email_active_uniq")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.deletedAt} is null`),
  ],
);

// ── §5 Galleries ─────────────────────────────────────────────────────────────
export const gallery = pgTable(
  "gallery",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    visibility: text("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("private"),
    status: text("status", { enum: ["draft", "published", "archived"] })
      .notNull()
      .default("draft"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    coverPhotoId: text("cover_photo_id"),
    pageConfigId: text("page_config_id"),
    clientId: text("client_id").references(() => client.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    passwordHash: text("password_hash"),
    downloadEnabled: boolean("download_enabled").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("gallery_owner_idx").on(t.ownerId),
    index("gallery_client_idx").on(t.clientId),
    index("gallery_public_listing_idx")
      .on(t.visibility, t.status)
      .where(sql`${t.deletedAt} is null`),
  ],
);

// ── §6 Gallery access grants (share links) ───────────────────────────────────
export const galleryAccessGrant = pgTable(
  "gallery_access_grant",
  {
    id: text("id").primaryKey(),
    galleryId: text("gallery_id")
      .notNull()
      .references(() => gallery.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => client.id, {
      onDelete: "set null",
    }),
    tokenHash: text("token_hash").notNull().unique(),
    label: text("label"),
    canView: boolean("can_view").notNull().default(true),
    canFavorite: boolean("can_favorite").notNull().default(true),
    canDownload: boolean("can_download").notNull().default(false),
    passwordHash: text("password_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    accessCount: integer("access_count").notNull().default(0),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("grant_gallery_idx").on(t.galleryId),
    index("grant_client_idx").on(t.clientId),
    index("grant_active_idx")
      .on(t.galleryId)
      .where(sql`${t.revokedAt} is null`),
  ],
);

// ── §7 Photos & variants ─────────────────────────────────────────────────────
export const photo = pgTable(
  "photo",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    originalStorageKey: text("original_storage_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    captureDate: timestamp("capture_date", { withTimezone: true }),
    dominantColor: text("dominant_color"),
    lqip: text("lqip"),
    blurhash: text("blurhash"),
    altText: text("alt_text"),
    exif: jsonb("exif"),
    processingStatus: text("processing_status", {
      enum: ["pending", "processing", "ready", "failed"],
    })
      .notNull()
      .default("pending"),
    processingError: text("processing_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("photo_owner_idx").on(t.ownerId),
    index("photo_status_idx").on(t.processingStatus),
    index("photo_capture_idx").on(t.captureDate),
    index("photo_active_idx")
      .on(t.createdAt)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export const photoVariant = pgTable(
  "photo_variant",
  {
    id: text("id").primaryKey(),
    photoId: text("photo_id")
      .notNull()
      .references(() => photo.id, { onDelete: "cascade" }),
    format: text("format", { enum: ["avif", "webp", "jpeg"] }).notNull(),
    sizeBucket: text("size_bucket", {
      enum: ["thumb", "small", "medium", "large", "xlarge"],
    }).notNull(),
    storageKey: text("storage_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("variant_unique").on(t.photoId, t.format, t.sizeBucket),
    index("variant_photo_idx").on(t.photoId),
  ],
);

// ── §8 Collections (categories) & locations ──────────────────────────────────
export const collection = pgTable("collection", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  kind: text("kind").notNull().default("category"),
  coverPhotoId: text("cover_photo_id").references(() => photo.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  pageConfigId: text("page_config_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const location = pgTable("location", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  region: text("region"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  coverPhotoId: text("cover_photo_id").references(() => photo.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const collectionPhoto = pgTable(
  "collection_photo",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collection.id, { onDelete: "cascade" }),
    photoId: text("photo_id")
      .notNull()
      .references(() => photo.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.photoId] }),
    index("collection_photo_order_idx").on(t.collectionId, t.sortOrder),
    index("collection_photo_photo_idx").on(t.photoId),
  ],
);

export const photoLocation = pgTable(
  "photo_location",
  {
    locationId: text("location_id")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    photoId: text("photo_id")
      .notNull()
      .references(() => photo.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.locationId, t.photoId] }),
    index("photo_location_order_idx").on(t.locationId, t.sortOrder),
    index("photo_location_photo_idx").on(t.photoId),
  ],
);

// ── §9 Gallery ↔ photo membership ────────────────────────────────────────────
export const galleryPhoto = pgTable(
  "gallery_photo",
  {
    galleryId: text("gallery_id")
      .notNull()
      .references(() => gallery.id, { onDelete: "cascade" }),
    photoId: text("photo_id")
      .notNull()
      .references(() => photo.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.galleryId, t.photoId] }),
    index("gallery_photo_order_idx").on(t.galleryId, t.sortOrder),
    index("gallery_photo_photo_idx").on(t.photoId),
  ],
);

// ── §10 Favorites ────────────────────────────────────────────────────────────
export const favorite = pgTable(
  "favorite",
  {
    id: text("id").primaryKey(),
    grantId: text("grant_id")
      .notNull()
      .references(() => galleryAccessGrant.id, { onDelete: "cascade" }),
    galleryId: text("gallery_id")
      .notNull()
      .references(() => gallery.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => client.id, {
      onDelete: "set null",
    }),
    photoId: text("photo_id")
      .notNull()
      .references(() => photo.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("favorite_unique").on(t.grantId, t.photoId),
    index("favorite_gallery_idx").on(t.galleryId),
    index("favorite_photo_idx").on(t.photoId),
  ],
);

// ── §11 Downloads (log) ──────────────────────────────────────────────────────
export const download = pgTable(
  "download",
  {
    id: text("id").primaryKey(),
    grantId: text("grant_id").references(() => galleryAccessGrant.id, {
      onDelete: "set null",
    }),
    galleryId: text("gallery_id").references(() => gallery.id, {
      onDelete: "set null",
    }),
    clientId: text("client_id").references(() => client.id, {
      onDelete: "set null",
    }),
    photoId: text("photo_id").references(() => photo.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: ["single", "zip"] }).notNull(),
    variant: text("variant"),
    status: text("status", {
      enum: ["requested", "building", "ready", "failed", "expired"],
    })
      .notNull()
      .default("requested"),
    jobId: text("job_id"),
    resultStorageKey: text("result_storage_key"),
    byteSize: bigint("byte_size", { mode: "number" }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("download_grant_idx").on(t.grantId),
    index("download_gallery_idx").on(t.galleryId),
    index("download_status_idx").on(t.status),
    index("download_created_idx").on(t.createdAt),
  ],
);

// ── §12 Layouts & page configs ───────────────────────────────────────────────
export const layout = pgTable("layout", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  schema: jsonb("schema"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const pageConfig = pgTable(
  "page_config",
  {
    id: text("id").primaryKey(),
    scope: text("scope", {
      enum: ["home", "gallery", "category", "location", "about", "global"],
    }).notNull(),
    layoutId: text("layout_id").references(() => layout.id, {
      onDelete: "set null",
    }),
    gridType: text("grid_type", {
      enum: ["masonry", "justified", "uniform"],
    }),
    spacing: text("spacing"),
    theme: text("theme", { enum: ["light", "dark", "auto"] }),
    hero: jsonb("hero"),
    config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("page_config_scope_idx").on(t.scope),
    uniqueIndex("page_config_default_uniq")
      .on(t.scope)
      .where(sql`${t.isDefault}`),
  ],
);

// ── §13 Store (DEFERRED stub tables) ─────────────────────────────────────────
export const product = pgTable("product", {
  id: text("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  kind: text("kind", { enum: ["print", "digital", "bundle"] }).notNull(),
  photoId: text("photo_id").references(() => photo.id, { onDelete: "set null" }),
  basePriceCents: integer("base_price_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const order = pgTable("order", {
  id: text("id").primaryKey(),
  clientId: text("client_id").references(() => client.id, {
    onDelete: "set null",
  }),
  email: text("email"),
  status: text("status", {
    enum: ["draft", "pending", "paid", "fulfilled", "cancelled"],
  })
    .notNull()
    .default("draft"),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  paymentProvider: text("payment_provider"),
  paymentRef: text("payment_ref"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const orderItem = pgTable("order_item", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => order.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => product.id, {
    onDelete: "set null",
  }),
  photoId: text("photo_id").references(() => photo.id, { onDelete: "set null" }),
  description: text("description"),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull().default(0),
  lineTotalCents: integer("line_total_cents").notNull().default(0),
});

export const invoice = pgTable("invoice", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .unique()
    .references(() => order.id, { onDelete: "cascade" }),
  number: text("number").notNull().unique(),
  status: text("status", { enum: ["draft", "issued", "paid", "void"] })
    .notNull()
    .default("draft"),
  amountCents: integer("amount_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  pdfStorageKey: text("pdf_storage_key"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── §14 Audit log (append-only) ──────────────────────────────────────────────
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorType: text("actor_type", { enum: ["user", "client", "system"] })
      .notNull()
      .default("user"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_actor_idx").on(t.actorId),
    index("audit_entity_idx").on(t.entityType, t.entityId),
    index("audit_action_idx").on(t.action),
    index("audit_created_idx").on(t.createdAt),
  ],
);

// ── §15 Contact submissions ──────────────────────────────────────────────────
export const contactSubmission = pgTable(
  "contact_submission",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    subject: text("subject"),
    message: text("message").notNull(),
    spamScore: real("spam_score"),
    spamVerdict: text("spam_verdict", { enum: ["ham", "spam", "unknown"] })
      .notNull()
      .default("unknown"),
    spamSignals: jsonb("spam_signals"),
    status: text("status", {
      enum: ["new", "read", "replied", "archived", "spam"],
    })
      .notNull()
      .default("new"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    handledBy: text("handled_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("contact_status_idx").on(t.status),
    index("contact_created_idx").on(t.createdAt),
    index("contact_verdict_idx").on(t.spamVerdict),
  ],
);
