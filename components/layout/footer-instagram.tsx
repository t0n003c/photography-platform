import { resolveInstagramProvider } from "@/src/instagram";
import type { InstagramItem } from "@/src/instagram/provider";

// Footer Instagram strip. Server component — reuses the Instagram provider
// (token-backed when configured, otherwise the recent-photos fallback). Renders
// nothing if no items resolve.
export async function FooterInstagram({ limit }: { limit: number }) {
  let items: InstagramItem[] = [];
  try {
    const provider = await resolveInstagramProvider();
    items = await provider.getFeed(Math.max(1, Math.min(12, limit)));
  } catch {
    items = [];
  }
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((it) => (
        <a
          key={it.id}
          href={it.permalink || "#"}
          target="_blank"
          rel="noreferrer noopener"
          className="block h-16 w-16 overflow-hidden rounded-sm md:h-20 md:w-20"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={it.imageUrl}
            alt={it.caption ?? "Instagram photo"}
            loading="lazy"
            className="h-full w-full object-cover transition-opacity hover:opacity-90"
          />
        </a>
      ))}
    </div>
  );
}
