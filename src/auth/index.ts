import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { twoFactor, admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";
import { passkey } from "@better-auth/passkey";
import { nextCookies } from "better-auth/next-js";
import { passkeyTwoFactor } from "./passkey-two-factor";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";
import { getRedis } from "@/src/redis/client";
import { getEnv } from "@/src/lib/env";

const env = getEnv();
const rpHost = new URL(env.BETTER_AUTH_URL).hostname;

// In local dev, treat localhost and 127.0.0.1 (same port) as the same origin so
// either URL works for password login. (Empty in production.) Biometric/passkey
// still needs the canonical host, since rpID is the BETTER_AUTH_URL hostname.
const localAliases: string[] = (() => {
  const u = new URL(env.APP_BASE_URL);
  if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
    const other = u.hostname === "localhost" ? "127.0.0.1" : "localhost";
    return [`${u.protocol}//${other}${u.port ? `:${u.port}` : ""}`];
  }
  return [];
})();

// Role access control (SECURITY.md §2.5 / DATA-MODEL §3.1). owner + admin get
// full admin-plugin capabilities; staff is a non-admin content role.
const ac = createAccessControl(defaultStatements);
export const roles = {
  owner: ac.newRole(adminAc.statements),
  admin: ac.newRole(adminAc.statements),
  staff: ac.newRole({ user: [], session: [] }),
};

// Better Auth: password + TOTP + passkeys, Redis-backed sessions + rate limit,
// admin roles (owner/admin/staff). See docs/SECURITY.md §2–§4. Connections are
// resolved lazily inside closures so importing this module never opens sockets
// (safe at build time).
export const auth = betterAuth({
  appName: "Photography Platform",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_BASE_URL, ...localAliases],

  database: drizzleAdapter(db, { provider: "pg", schema }),

  // Sessions + rate-limit counters live in Redis (shared, survives restarts,
  // instant revocation). SECURITY.md §4.2.
  secondaryStorage: {
    get: (key) => getRedis().get(key),
    set: async (key, value, ttl) => {
      if (ttl) await getRedis().set(key, value, "EX", ttl);
      else await getRedis().set(key, value);
    },
    delete: async (key) => {
      await getRedis().del(key);
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: false, // single-studio; admins are seeded/invited
    autoSignIn: false,
  },

  user: {
    additionalFields: {
      // Drives the biometric-first second-factor login (see passkeyTwoFactor).
      requireBiometric: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false, // set server-side via the account endpoint, not signup
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24, // absolute cap: 24h (SECURITY.md §4.3)
    updateAge: 60 * 60, // sliding refresh window: 1h
    // Step-up freshness window. Sensitive actions (passkey registration,
    // destructive deletes) require auth within this window. 15m was too
    // aggressive for a solo studio — 4h covers a normal work session.
    freshAge: 60 * 60 * 4,
  },

  // Per-IP / per-account rate limiting + lockout backoff (SECURITY.md §3).
  rateLimit: {
    enabled: true,
    storage: "secondary-storage",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 900, max: 5 }, // 5 / 15m then lockout
      "/two-factor/verify-totp": { window: 300, max: 5 },
      "/forget-password": { window: 3600, max: 3 },
    },
  },

  // Bot protection: when the admin enables it in Settings (and Turnstile keys
  // are configured), require a valid Turnstile token on the login endpoint.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const { getSiteSettingsRow } = await import("@/src/db/queries/settings");
      const row = await getSiteSettingsRow();
      if (!row?.captchaEnabled) return;
      const { verifyTurnstile } = await import("@/src/lib/turnstile");
      const token = ctx.headers?.get("x-captcha-response") ?? undefined;
      const ip =
        ctx.headers?.get("cf-connecting-ip") ??
        ctx.headers?.get("x-forwarded-for") ??
        undefined;
      const ok = await verifyTurnstile(token, ip ?? undefined);
      if (!ok) {
        throw new APIError("FORBIDDEN", {
          message: "Human verification failed. Please try again.",
          code: "CAPTCHA_FAILED",
        });
      }
    }),
  },

  advanced: {
    cookiePrefix: "photog",
    // Behind Cloudflare Tunnel + NPM; trust the edge-provided client IP only.
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
    },
  },

  plugins: [
    twoFactor(),
    passkey({
      rpID: rpHost,
      rpName: "Photography Platform",
      origin: env.APP_BASE_URL,
    }),
    // Biometric (passkey) as a strict second factor after password; falls back
    // to TOTP. Relies on the two-factor plugin's pending-login state above.
    passkeyTwoFactor({ rpID: rpHost, origin: env.APP_BASE_URL }),
    admin({
      ac,
      roles,
      defaultRole: "staff",
      adminRoles: ["owner", "admin"],
    }),
    // nextCookies() must be last so Set-Cookie propagates from server actions.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
export type Session = Auth["$Infer"]["Session"];
