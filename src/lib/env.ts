import { z } from "zod";

// Centralised, typed environment access shared by web + worker.
// Phase 1 uses permissive defaults so the scaffold boots anywhere; Phase 2
// tightens this (required secrets, no fallbacks) once auth/db are wired.
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z
    .string()
    .default("postgres://photog:photog@localhost:5432/photography"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  BETTER_AUTH_SECRET: z.string().default("dev-insecure-secret-change-me"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),

  // Encrypts editable secrets stored in the DB (e.g. the SMTP password set via
  // the Settings UI). 64 hex chars (32 bytes). Optional: when unset, a key is
  // derived from BETTER_AUTH_SECRET so dev boots, but set a dedicated value in
  // production. See src/lib/secrets.ts.
  SETTINGS_ENCRYPTION_KEY: z.string().optional(),

  STORAGE_DRIVER: z.enum(["minio", "filesystem"]).default("minio"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().default("minioadmin"),
  S3_SECRET_ACCESS_KEY: z.string().default("minioadmin"),
  S3_BUCKET: z.string().default("photography-media"),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  STORAGE_FS_PATH: z.string().default("/data/media"),

  // Email — defaults to "log" so nothing is sent externally without config.
  EMAIL_DRIVER: z.enum(["log", "smtp", "resend"]).default("log"),
  EMAIL_FROM: z.string().default("Studio <hello@example.com>"),
  CONTACT_NOTIFY_EMAIL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Web Push / PWA notifications. VAPID keys are public/private key pairs used
  // to authenticate this server to browser push services.
  WEB_PUSH_PUBLIC_KEY: z.string().optional(),
  WEB_PUSH_PRIVATE_KEY: z.string().optional(),
  WEB_PUSH_SUBJECT: z.string().optional(),

  PAYMENTS_DRIVER: z.enum(["stub", "stripe"]).default("stub"),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Instagram (optional) — when IG_ACCESS_TOKEN is set, the "From the field"
  // home section pulls the real IG feed via the Graph API; otherwise it falls
  // back to recent public photos. Inert without a token.
  IG_ACCESS_TOKEN: z.string().optional(),

  // Remotion slideshow video rendering — opt-in (needs the Chromium-enabled
  // worker image). Off by default; the admin endpoint returns 501 when false.
  VIDEO_RENDER_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  WORKER_HEALTH_PORT: z.coerce.number().default(9091),

  // Cloudflare Turnstile (bot protection at login). Optional; when both are set
  // and the admin enables it in Settings, the login form requires a Turnstile
  // token. Use Cloudflare's always-pass TEST keys on localhost.
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) cached = EnvSchema.parse(process.env);
  return cached;
}
