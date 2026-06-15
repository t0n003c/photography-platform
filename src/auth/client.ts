"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient, adminClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

// Browser-side auth client mirroring the server plugins.
export const authClient = createAuthClient({
  plugins: [twoFactorClient(), passkeyClient(), adminClient()],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  twoFactor,
  passkey,
  admin,
} = authClient;
