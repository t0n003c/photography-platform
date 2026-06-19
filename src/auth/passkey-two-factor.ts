import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie, expireCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import { base64 } from "@better-auth/utils/base64";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import * as z from "zod";

// Biometric (passkey) as a STRICT second factor after password, bound to the
// pending two-factor login so it can't be used to skip the password. After a
// correct password (with TOTP 2FA enabled), Better Auth puts the account in a
// "two_factor" pending state; here we verify a passkey assertion against THAT
// pending user's credentials and only then complete the session. TOTP remains
// the fallback (better-auth's built-in /two-factor/verify-totp).

// Matches better-auth's two-factor plugin cookie name (constant.ts).
const TWO_FACTOR_COOKIE = "two_factor";
const CHALLENGE_COOKIE = "two-factor-passkey";
const CHALLENGE_TTL = 300; // seconds

interface Options {
  rpID: string;
  origin: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// Resolve the pending-2FA user from the signed two_factor cookie.
async function getPending(ctx: any) {
  const cookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE);
  const signed = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  if (!signed) {
    throw new APIError("UNAUTHORIZED", {
      message: "No pending sign-in.",
      code: "NO_PENDING_TWO_FACTOR",
    });
  }
  const vt = await ctx.context.internalAdapter.findVerificationValue(signed);
  if (!vt) {
    throw new APIError("UNAUTHORIZED", {
      message: "Sign-in expired. Start over.",
      code: "INVALID_TWO_FACTOR_COOKIE",
    });
  }
  const user = await ctx.context.internalAdapter.findUserById(vt.value);
  if (!user) {
    throw new APIError("UNAUTHORIZED", {
      message: "User not found.",
      code: "INVALID_TWO_FACTOR_COOKIE",
    });
  }
  return { user, cookieValue: signed, cookie };
}

export const passkeyTwoFactor = (opts: Options) =>
  ({
    id: "passkey-two-factor",
    endpoints: {
      // Returns assertion options for the pending user's passkeys, or
      // { available: false } when biometric doesn't apply (so the login page
      // falls straight back to the TOTP form).
      passkeyTwoFactorOptions: createAuthEndpoint(
        "/two-factor/passkey/options",
        { method: "POST" },
        async (ctx: any) => {
          const { user } = await getPending(ctx);
          const passkeys = await ctx.context.adapter.findMany({
            model: "passkey",
            where: [{ field: "userId", value: user.id }],
          });
          if (!user.requireBiometric || passkeys.length === 0) {
            return ctx.json({ available: false });
          }
          const options = await generateAuthenticationOptions({
            rpID: opts.rpID,
            userVerification: "preferred",
            allowCredentials: passkeys.map((p: any) => ({
              id: p.credentialID,
              transports: p.transports?.split(","),
            })),
          });
          const token = generateRandomString(32);
          const cookie = ctx.context.createAuthCookie(CHALLENGE_COOKIE);
          await ctx.setSignedCookie(cookie.name, token, ctx.context.secret, {
            ...cookie.attributes,
            maxAge: CHALLENGE_TTL,
          });
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: token,
            value: JSON.stringify({
              expectedChallenge: options.challenge,
              userId: user.id,
            }),
            expiresAt: new Date(Date.now() + CHALLENGE_TTL * 1000),
          });
          return ctx.json({ available: true, options });
        },
      ),

      // Verifies the assertion against the pending user's passkey, then
      // completes the login (creates the session) — the same way the built-in
      // TOTP verify does.
      passkeyTwoFactorVerify: createAuthEndpoint(
        "/two-factor/passkey/verify",
        { method: "POST", body: z.object({ response: z.any() }) },
        async (ctx: any) => {
          const { user, cookieValue, cookie: tfCookie } = await getPending(ctx);
          if (!user.requireBiometric) {
            throw new APIError("FORBIDDEN", {
              message: "Biometric sign-in is not enabled.",
              code: "BIOMETRIC_NOT_ENABLED",
            });
          }
          const origin = opts.origin || ctx.headers?.get("origin") || "";
          if (!origin) {
            throw new APIError("BAD_REQUEST", {
              message: "Origin missing.",
              code: "ORIGIN_MISSING",
            });
          }
          const resp = ctx.body.response;

          const chCookie = ctx.context.createAuthCookie(CHALLENGE_COOKIE);
          const token = await ctx.getSignedCookie(chCookie.name, ctx.context.secret);
          if (!token) {
            throw new APIError("BAD_REQUEST", {
              message: "Challenge not found. Try again.",
              code: "CHALLENGE_NOT_FOUND",
            });
          }
          const data = await ctx.context.internalAdapter.consumeVerificationValue(token);
          if (!data) {
            throw new APIError("BAD_REQUEST", {
              message: "Challenge not found. Try again.",
              code: "CHALLENGE_NOT_FOUND",
            });
          }
          const { expectedChallenge, userId } = JSON.parse(data.value);
          if (userId !== user.id) {
            throw new APIError("UNAUTHORIZED", {
              message: "Verification mismatch.",
              code: "MISMATCH",
            });
          }

          // The asserted credential must belong to the pending user.
          const passkey = await ctx.context.adapter.findOne({
            model: "passkey",
            where: [{ field: "credentialID", value: resp.id }],
          });
          if (!passkey || passkey.userId !== user.id) {
            throw new APIError("UNAUTHORIZED", {
              message: "Passkey not recognized.",
              code: "PASSKEY_NOT_FOUND",
            });
          }

          const verification = await verifyAuthenticationResponse({
            response: resp,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: opts.rpID,
            credential: {
              id: passkey.credentialID,
              publicKey: base64.decode(passkey.publicKey),
              counter: passkey.counter,
              transports: passkey.transports?.split(","),
            },
            requireUserVerification: false,
          });
          if (!verification.verified) {
            throw new APIError("UNAUTHORIZED", {
              message: "Biometric verification failed.",
              code: "AUTH_FAILED",
            });
          }
          await ctx.context.adapter.update({
            model: "passkey",
            where: [{ field: "id", value: passkey.id }],
            update: { counter: verification.authenticationInfo.newCounter },
          });

          // Complete the pending login (mirror better-auth verify-two-factor).
          const consumed =
            await ctx.context.internalAdapter.consumeVerificationValue(cookieValue);
          if (!consumed || consumed.value !== user.id) {
            expireCookie(ctx, tfCookie);
            throw new APIError("UNAUTHORIZED", {
              message: "Sign-in expired. Start over.",
              code: "INVALID_TWO_FACTOR_COOKIE",
            });
          }
          const session = await ctx.context.internalAdapter.createSession(
            user.id,
            false,
          );
          if (!session) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Could not create session.",
              code: "SESSION_FAILED",
            });
          }
          await setSessionCookie(ctx, { session, user });
          expireCookie(ctx, tfCookie);
          return ctx.json({ success: true });
        },
      ),
    },
  }) as any;
