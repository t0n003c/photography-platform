// Next.js startup hook (runs once when the server boots — NOT during build).
// Fails closed in production if critical secrets are missing or left at their
// insecure defaults (SECURITY.md §8). A known BETTER_AUTH_SECRET would let an
// attacker forge sessions and gallery-unlock cookies.
export async function register() {
  if (process.env.NODE_ENV !== "production") return;

  const secret = process.env.BETTER_AUTH_SECRET;
  const insecure =
    !secret ||
    secret === "dev-insecure-secret-change-me" ||
    secret === "change-me-with-openssl-rand-base64-32" ||
    secret.length < 32;

  if (insecure) {
    throw new Error(
      "BETTER_AUTH_SECRET must be a strong, unique value in production " +
        "(e.g. `openssl rand -base64 48`). Refusing to start.",
    );
  }
}
