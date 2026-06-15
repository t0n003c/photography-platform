import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/src/auth";

// Mounts all Better Auth routes under /api/auth/* (sign-in, 2FA, passkey, …).
// These are owned by Better Auth and are not versioned (API-DESIGN §1).
export const { GET, POST } = toNextJsHandler(auth);
