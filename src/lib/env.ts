import { z } from "zod";

// Centralised, typed environment access shared by web + worker.
// Phase 1 uses permissive defaults so the scaffold boots anywhere; Phase 2
// tightens this (required secrets, no fallbacks) once auth/db are wired.
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z
    .string()
    .default("postgres://photog:photog@localhost:5432/photography"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

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

  EMAIL_DRIVER: z.enum(["smtp", "resend"]).default("smtp"),
  PAYMENTS_DRIVER: z.enum(["stub", "stripe"]).default("stub"),

  WORKER_HEALTH_PORT: z.coerce.number().default(9091),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) cached = EnvSchema.parse(process.env);
  return cached;
}
