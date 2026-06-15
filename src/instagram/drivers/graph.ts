import { getEnv } from "@/src/lib/env";
import type {
  InstagramItem,
  InstagramProvider,
} from "@/src/instagram/provider";

// Instagram Graph API driver (no SDK — plain fetch). Selected when
// IG_ACCESS_TOKEN is set. Resilient by contract: any failure (missing token,
// network error, non-2xx, malformed payload) returns [] so the home page simply
// hides the section rather than erroring.
interface GraphMediaNode {
  id: string;
  media_type: string;
  media_url?: string;
  permalink?: string;
  caption?: string;
}

interface GraphMediaResponse {
  data?: GraphMediaNode[];
}

export class GraphInstagramProvider implements InstagramProvider {
  private token: string;

  constructor() {
    this.token = getEnv().IG_ACCESS_TOKEN ?? "";
  }

  async getFeed(limit: number): Promise<InstagramItem[]> {
    if (!this.token) return [];
    try {
      const url =
        `https://graph.instagram.com/me/media` +
        `?fields=id,media_type,media_url,permalink,caption` +
        `&access_token=${encodeURIComponent(this.token)}` +
        `&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = (await res.json()) as GraphMediaResponse;
      const nodes = json.data ?? [];
      return nodes
        .filter(
          (n) =>
            (n.media_type === "IMAGE" ||
              n.media_type === "CAROUSEL_ALBUM") &&
            typeof n.media_url === "string" &&
            typeof n.permalink === "string",
        )
        .slice(0, limit)
        .map((n) => ({
          id: n.id,
          imageUrl: n.media_url as string,
          permalink: n.permalink as string,
          caption: n.caption,
        }));
    } catch {
      return [];
    }
  }
}
