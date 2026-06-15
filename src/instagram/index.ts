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
