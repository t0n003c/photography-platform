// InstagramProvider seam — a swappable "From the field" feed source, mirroring
// the EmailProvider/StorageProvider pattern. The Graph driver pulls the real IG
// feed when a token is configured; the fallback driver reuses recent public
// photos so the section keeps its visual behavior when IG isn't wired.
export interface InstagramItem {
  id: string;
  imageUrl: string;
  permalink: string;
  caption?: string;
}

export interface InstagramProvider {
  getFeed(limit: number): Promise<InstagramItem[]>;
}
