"use client";

import * as React from "react";
import { Download, Heart, ImageOff } from "lucide-react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Spinner, EmptyState } from "@/components/ui/feedback";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { Lightbox } from "@/components/gallery/lightbox";
import { cn } from "@/src/lib/utils";
import { UnlockForm } from "./unlock-form";

interface ClientGalleryProps {
  token: string;
}

interface GalleryMeta {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  downloadEnabled: boolean;
}

interface Permissions {
  view: boolean;
  favorite: boolean;
  download: boolean;
}

interface GalleryResponse {
  gallery: GalleryMeta;
  permissions: Permissions;
  pageConfig?: unknown;
}

interface ApiError {
  error?: { code?: string; message?: string };
}

type Status = "loading" | "locked" | "error" | "ready";

const TILE_SIZES = "(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw";
const PAGE_LIMIT = 48;

async function readErrorCode(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as ApiError;
    return body.error?.code;
  } catch {
    return undefined;
  }
}

/** Create a temporary <a download> and click it to trigger a browser download. */
function triggerBrowserDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function ClientGallery({ token }: ClientGalleryProps) {
  const [status, setStatus] = React.useState<Status>("loading");
  const [meta, setMeta] = React.useState<GalleryMeta | null>(null);
  const [permissions, setPermissions] = React.useState<Permissions>({
    view: true,
    favorite: false,
    download: false,
  });

  const [photos, setPhotos] = React.useState<PhotoDTO[]>([]);
  const [favoritePhotos, setFavoritePhotos] = React.useState<PhotoDTO[]>([]);
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(new Set());
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);

  const [loadingPhotos, setLoadingPhotos] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [photosError, setPhotosError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  // Which zip scope is currently being prepared (null = idle).
  const [preparingZip, setPreparingZip] = React.useState<
    "all" | "favorites" | null
  >(null);
  // Photo ids currently being toggled (to avoid duplicate requests).
  const [pendingFavorites, setPendingFavorites] = React.useState<Set<string>>(
    new Set(),
  );

  // ---- Initial gallery fetch ---------------------------------------------
  const loadGallery = React.useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/v1/g/${token}`);
      if (res.ok) {
        const body = (await res.json()) as GalleryResponse;
        setMeta(body.gallery);
        setPermissions(body.permissions);
        setStatus("ready");
        return;
      }
      if (res.status === 401) {
        const code = await readErrorCode(res);
        if (code === "GALLERY_LOCKED") {
          setStatus("locked");
          return;
        }
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }, [token]);

  React.useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  // ---- Photos + favorites load (after gallery is ready) ------------------
  const loadInitialPhotos = React.useCallback(async () => {
    setLoadingPhotos(true);
    setPhotosError(null);
    try {
      const res = await fetch(
        `/api/v1/g/${token}/photos?limit=${PAGE_LIMIT}&cursor=`,
      );
      if (!res.ok) {
        setPhotosError("We couldn’t load these photos. Please refresh.");
        return;
      }
      const body = (await res.json()) as {
        data: PhotoDTO[];
        page: { nextCursor: string | null; hasMore: boolean };
      };
      setPhotos(body.data);
      setCursor(body.page.nextCursor);
      setHasMore(body.page.hasMore);
    } catch {
      setPhotosError("We couldn’t load these photos. Please refresh.");
    } finally {
      setLoadingPhotos(false);
    }
  }, [token]);

  const loadFavorites = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/g/${token}/favorites`);
      if (!res.ok) return;
      const body = (await res.json()) as { data: PhotoDTO[] };
      setFavoritePhotos(body.data);
      setFavoriteIds(new Set(body.data.map((p) => p.id)));
    } catch {
      // Non-fatal: favorites simply start empty.
    }
  }, [token]);

  React.useEffect(() => {
    if (status !== "ready") return;
    void loadInitialPhotos();
    if (permissions.favorite) void loadFavorites();
  }, [status, permissions.favorite, loadInitialPhotos, loadFavorites]);

  const loadMore = React.useCallback(async () => {
    if (!hasMore || loadingMore || cursor === null) return;
    setLoadingMore(true);
    setPhotosError(null);
    try {
      const res = await fetch(
        `/api/v1/g/${token}/photos?limit=${PAGE_LIMIT}&cursor=${encodeURIComponent(
          cursor,
        )}`,
      );
      if (!res.ok) {
        setPhotosError("We couldn’t load more photos. Please try again.");
        return;
      }
      const body = (await res.json()) as {
        data: PhotoDTO[];
        page: { nextCursor: string | null; hasMore: boolean };
      };
      setPhotos((prev) => [...prev, ...body.data]);
      setCursor(body.page.nextCursor);
      setHasMore(body.page.hasMore);
    } catch {
      setPhotosError("We couldn’t load more photos. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [token, cursor, hasMore, loadingMore]);

  // ---- Favorites toggle (optimistic) -------------------------------------
  const toggleFavorite = React.useCallback(
    async (photo: PhotoDTO) => {
      if (!permissions.favorite) return;
      if (pendingFavorites.has(photo.id)) return;

      const wasFavorited = favoriteIds.has(photo.id);
      setActionError(null);
      setPendingFavorites((prev) => new Set(prev).add(photo.id));

      // Optimistic update.
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.delete(photo.id);
        else next.add(photo.id);
        return next;
      });
      setFavoritePhotos((prev) =>
        wasFavorited
          ? prev.filter((p) => p.id !== photo.id)
          : [...prev, photo],
      );

      try {
        const res = await fetch(
          `/api/v1/g/${token}/photos/${photo.id}/favorite`,
          { method: wasFavorited ? "DELETE" : "PUT" },
        );
        if (!res.ok) throw new Error("favorite failed");
      } catch {
        // Roll back on failure.
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorited) next.add(photo.id);
          else next.delete(photo.id);
          return next;
        });
        setFavoritePhotos((prev) =>
          wasFavorited
            ? [...prev, photo]
            : prev.filter((p) => p.id !== photo.id),
        );
        setActionError("Couldn’t update favorite. Please try again.");
      } finally {
        setPendingFavorites((prev) => {
          const next = new Set(prev);
          next.delete(photo.id);
          return next;
        });
      }
    },
    [token, permissions.favorite, favoriteIds, pendingFavorites],
  );

  // ---- Single download ---------------------------------------------------
  const downloadSingle = React.useCallback(
    async (photo: PhotoDTO) => {
      if (!permissions.download) return;
      setActionError(null);
      try {
        const res = await fetch(`/api/v1/g/${token}/download`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "single", photoId: photo.id }),
        });
        if (!res.ok) throw new Error("download failed");
        const body = (await res.json()) as { url: string };
        triggerBrowserDownload(body.url);
      } catch {
        setActionError("Couldn’t start that download. Please try again.");
      }
    },
    [token, permissions.download],
  );

  // ---- Zip download (build + poll) ---------------------------------------
  const downloadZip = React.useCallback(
    async (scope: "all" | "favorites") => {
      if (!permissions.download || preparingZip) return;
      setActionError(null);
      setPreparingZip(scope);
      try {
        const res = await fetch(`/api/v1/g/${token}/download`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "zip", scope }),
        });
        if (!res.ok) throw new Error("zip request failed");
        const body = (await res.json()) as {
          download: { id: string; status: string };
        };
        const downloadId = body.download.id;

        // Poll every ~2s until ready.
        const url = await new Promise<string>((resolve, reject) => {
          const interval = window.setInterval(() => {
            void (async () => {
              try {
                const pollRes = await fetch(
                  `/api/v1/g/${token}/download/${downloadId}`,
                );
                if (!pollRes.ok) {
                  window.clearInterval(interval);
                  reject(new Error("poll failed"));
                  return;
                }
                const pollBody = (await pollRes.json()) as {
                  download: { status: string };
                  url?: string;
                };
                if (pollBody.download.status === "ready" && pollBody.url) {
                  window.clearInterval(interval);
                  resolve(pollBody.url);
                } else if (
                  pollBody.download.status !== "building" &&
                  pollBody.download.status !== "ready"
                ) {
                  window.clearInterval(interval);
                  reject(new Error("zip failed"));
                }
              } catch {
                window.clearInterval(interval);
                reject(new Error("poll error"));
              }
            })();
          }, 2000);
        });

        triggerBrowserDownload(url);
      } catch {
        setActionError("Couldn’t prepare that download. Please try again.");
      } finally {
        setPreparingZip(null);
      }
    },
    [token, permissions.download, preparingZip],
  );

  // ---- Derived list (filtered) -------------------------------------------
  const visiblePhotos = showFavoritesOnly ? favoritePhotos : photos;

  const openLightbox = React.useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  // ---- Render branches ----------------------------------------------------
  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))]">
        <Spinner className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
        <span className="sr-only">Loading gallery…</span>
      </main>
    );
  }

  if (status === "locked") {
    return <UnlockForm token={token} onUnlocked={loadGallery} />;
  }

  if (status === "error" || !meta) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-4">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
            <ImageOff
              className="h-5 w-5 text-[hsl(var(--muted-foreground))]"
              aria-hidden="true"
            />
          </div>
          <h1 className="text-lg font-semibold">Gallery unavailable</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            This link is invalid or has expired.
          </p>
        </div>
      </main>
    );
  }

  const showActionBar =
    permissions.favorite || permissions.download;

  return (
    <main className="min-h-screen bg-[hsl(var(--background))] pb-20">
      {/* Header */}
      <header className="border-b">
        <Container className="py-10 sm:py-14">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {meta.title}
          </h1>
          {meta.subtitle && (
            <p className="mt-1 text-lg text-[hsl(var(--muted-foreground))]">
              {meta.subtitle}
            </p>
          )}
          {meta.description && (
            <p className="mt-2 max-w-2xl text-[hsl(var(--muted-foreground))]">
              {meta.description}
            </p>
          )}
        </Container>
      </header>

      {/* Sticky action bar */}
      {showActionBar && (
        <div className="sticky top-0 z-30 border-b bg-[hsl(var(--background))]/85 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/70">
          <Container className="flex flex-col gap-3 py-3 sm:flex-row sm:flex-wrap sm:items-center">
            {permissions.favorite && (
              <Button
                type="button"
                variant={showFavoritesOnly ? "default" : "outline"}
                size="sm"
                aria-pressed={showFavoritesOnly}
                onClick={() => setShowFavoritesOnly((v) => !v)}
              >
                <Heart
                  className={cn(
                    "h-4 w-4",
                    showFavoritesOnly && "fill-current",
                  )}
                  aria-hidden="true"
                />
                {showFavoritesOnly ? "Showing favorites" : "Favorites"}
                <span className="text-[hsl(var(--muted-foreground))]">
                  {favoriteIds.size > 0 ? `(${favoriteIds.size})` : ""}
                </span>
              </Button>
            )}

            {permissions.download && (
              <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  disabled={preparingZip !== null}
                  onClick={() => void downloadZip("all")}
                >
                  {preparingZip === "all" ? (
                    <Spinner className="text-current" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                  {preparingZip === "all" ? "Preparing…" : "Download all"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  disabled={preparingZip !== null || favoriteIds.size === 0}
                  onClick={() => void downloadZip("favorites")}
                >
                  {preparingZip === "favorites" ? (
                    <Spinner className="text-current" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                  {preparingZip === "favorites"
                    ? "Preparing…"
                    : "Download favorites"}
                </Button>
              </div>
            )}
          </Container>
        </div>
      )}

      {/* Inline action error */}
      {actionError && (
        <Container className="pt-4">
          <p role="alert" className="text-sm text-red-600">
            {actionError}
          </p>
        </Container>
      )}

      {/* Grid */}
      <Container className="pt-8">
        {loadingPhotos ? (
          <div className="flex justify-center py-20">
            <Spinner className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
            <span className="sr-only">Loading photos…</span>
          </div>
        ) : photosError && visiblePhotos.length === 0 ? (
          <EmptyState
            title="Couldn’t load photos"
            description={photosError}
            action={
              <Button size="sm" onClick={() => void loadInitialPhotos()}>
                Retry
              </Button>
            }
          />
        ) : visiblePhotos.length === 0 ? (
          <EmptyState
            title={showFavoritesOnly ? "No favorites yet" : "No photos yet"}
            description={
              showFavoritesOnly
                ? "Tap the heart on a photo to add it to your favorites."
                : "This gallery doesn’t have any photos."
            }
          />
        ) : (
          <div className="[column-fill:_balance] gap-4 [columns:1] sm:[columns:2] lg:[columns:3] 2xl:[columns:4]">
            {visiblePhotos.map((photo, index) => {
              const favorited = favoriteIds.has(photo.id);
              const pending = pendingFavorites.has(photo.id);
              return (
                <div
                  key={photo.id}
                  className="group relative mb-4 break-inside-avoid overflow-hidden rounded-lg bg-[hsl(var(--muted))]"
                >
                  <button
                    type="button"
                    onClick={() => openLightbox(index)}
                    aria-label={`Open ${
                      photo.altText ?? "photo"
                    } in full screen`}
                    className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                    style={{
                      aspectRatio: `${photo.width} / ${photo.height}`,
                    }}
                  >
                    <ResponsiveImage
                      photo={photo}
                      sizes={TILE_SIZES}
                      priority={index < 4}
                      className="h-full w-full transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </button>

                  {/* Hover/tap overlay */}
                  {(permissions.favorite || permissions.download) && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end gap-2 bg-gradient-to-b from-black/40 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      {permissions.favorite && (
                        <button
                          type="button"
                          onClick={() => void toggleFavorite(photo)}
                          disabled={pending}
                          aria-pressed={favorited}
                          aria-label={
                            favorited
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                        >
                          <Heart
                            className={cn(
                              "h-5 w-5",
                              favorited && "fill-current text-red-500",
                            )}
                            aria-hidden="true"
                          />
                        </button>
                      )}
                      {permissions.download && (
                        <button
                          type="button"
                          onClick={() => void downloadSingle(photo)}
                          aria-label="Download photo"
                          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          <Download className="h-5 w-5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Load more — only meaningful in the full (non-favorites) view */}
        {!showFavoritesOnly && hasMore && (
          <div className="mt-10 flex flex-col items-center gap-3">
            {photosError && visiblePhotos.length > 0 && (
              <p role="alert" className="text-sm text-red-600">
                {photosError}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore && <Spinner className="text-current" />}
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </Container>

      {/* Lightbox */}
      <Lightbox
        photos={visiblePhotos}
        index={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxIndex}
      />
    </main>
  );
}
