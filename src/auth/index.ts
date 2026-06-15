// Better Auth configuration — PLACEHOLDER (implemented in Phase 2).
//
// Phase 2 wires Better Auth with the Drizzle adapter and enables:
//   - email + password
//   - TOTP 2FA
//   - WebAuthn / passkeys (stronger, passwordless-capable factor)
//   - rate limiting + max-attempt lockout + session management
// Admin policy controls which factors are required. See docs/SECURITY.md.
//
// Kept inert here so the module path exists without constructing an auth
// instance (which needs the DB schema) during the Phase 1 scaffold.
export const AUTH_READY = false;
