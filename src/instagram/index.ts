import { getEnv } from "@/src/lib/env";
import type { InstagramProvider } from "@/src/instagram/provider";
import { GraphInstagramProvider } from "@/src/instagram/drivers/graph";
import { FallbackInstagramProvider } from "@/src/instagram/drivers/fallback";

export type { InstagramProvider, InstagramItem } from "@/src/instagram/provider";

let provider: InstagramProvider | null = null;

// Driver selection happens once, here. Call sites use getInstagramProvider().
// GraphInstagramProvider when IG_ACCESS_TOKEN is configured; otherwise the
// fallback driver (recent public photos) so the section stays inert-but-visible.
export function getInstagramProvider(): InstagramProvider {
  if (provider) return provider;
  provider = getEnv().IG_ACCESS_TOKEN
    ? new GraphInstagramProvider()
    : new FallbackInstagramProvider();
  return provider;
}

// DB-aware resolver: prefers the Instagram token saved in Settings → Integrations
// (decrypted), falling back to IG_ACCESS_TOKEN, then the recent-photos fallback.
// Constructed per call so admin changes take effect without a restart.
export async function resolveInstagramProvider(): Promise<InstagramProvider> {
  try {
    const { getInstagramToken } = await import("@/src/db/queries/settings");
    const token = await getInstagramToken();
    if (token) return new GraphInstagramProvider(token);
  } catch {
    // fall through to env/fallback
  }
  return getInstagramProvider();
}
