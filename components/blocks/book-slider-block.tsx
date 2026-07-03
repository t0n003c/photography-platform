"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { cn } from "@/src/lib/utils";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";

type BookSliderBlockData = Extract<LeafBlock, { type: "bookSlider" }>;
type BookSliderPage = BookSliderBlockData["pages"][number];
type CSSPropertiesWithVars = CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

type PageFlipApi = {
  flipNext: (corner?: "top" | "bottom") => void;
  flipPrev: (corner?: "top" | "bottom") => void;
  getPageCount: () => number;
};
type PageFlipHandle = {
  pageFlip: () => PageFlipApi | undefined;
};
type FlipEvent = {
  data: number;
};
type FlipBookProps = {
  width: number;
  height: number;
  size: "fixed" | "stretch";
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  startPage: number;
  drawShadow: boolean;
  flippingTime: number;
  usePortrait: boolean;
  startZIndex: number;
  autoSize: boolean;
  maxShadowOpacity: number;
  showCover: boolean;
  mobileScrollSupport: boolean;
  clickEventForward: boolean;
  useMouseEvents: boolean;
  swipeDistance: number;
  showPageCorners: boolean;
  disableFlipByClick: boolean;
  className: string;
  style: CSSProperties;
  children: ReactNode;
  onFlip?: (event: FlipEvent) => void;
  onInit?: () => void;
};

const HTMLFlipBook = dynamic(() => import("react-pageflip"), {
  ssr: false,
}) as unknown as ComponentType<FlipBookProps & { ref?: Ref<PageFlipHandle> }>;

const SIZE_CONFIG = {
  compact: { width: 300, height: 420, maxWidth: "max-w-4xl" },
  standard: { width: 360, height: 500, maxWidth: "max-w-5xl" },
  large: { width: 420, height: 580, maxWidth: "max-w-6xl" },
} satisfies Record<
  NonNullable<BookSliderBlockData["size"]>,
  { width: number; height: number; maxWidth: string }
>;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const sync = () => setMatches(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, [query]);

  return matches;
}

function selectedPhoto(photoId: string | null | undefined, photoMap: Map<string, PhotoDTO>) {
  return photoId ? photoMap.get(photoId) : undefined;
}

function linkIsExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

function PageLink({ href, children }: { href: string; children: ReactNode }) {
  if (linkIsExternal(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return <Link href={href}>{children}</Link>;
}

function BookPageContent({
  page,
  index,
  photo,
}: {
  page: BookSliderPage;
  index: number;
  photo?: PhotoDTO;
}) {
  const linkLabel = page.linkLabel?.trim();
  const linkHref = page.linkHref?.trim();
  const fullImage = (page.imageMode ?? "editorial") === "full";

  if (fullImage) {
    return (
      <div className="relative z-10 h-full min-h-[inherit] overflow-hidden text-white">
        {photo ? (
          <ResponsiveImage
            photo={photo}
            sizes="(max-width: 767px) 82vw, 420px"
            priority={index < 2}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 text-sm opacity-80">
            Page image
          </div>
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/82 via-black/28 to-black/8" />
        <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
            {String(index + 1).padStart(2, "0")}
          </p>
          <h3 className="max-w-[18rem] text-balance font-serif text-3xl font-semibold leading-[0.98] text-white drop-shadow sm:text-4xl">
            {page.headline || `Page ${index + 1}`}
          </h3>
          {page.subhead && (
            <p className="mt-3 max-w-[19rem] text-sm leading-relaxed text-white/82">
              {page.subhead}
            </p>
          )}
          {page.caption && (
            <p className="mt-4 line-clamp-3 max-w-[19rem] text-xs leading-relaxed text-white/68">
              {page.caption}
            </p>
          )}
          {linkLabel && linkHref && (
            <PageLink href={linkHref}>
              <span className="mt-5 inline-flex rounded-full border border-white/45 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur transition hover:bg-white/18">
                {linkLabel}
              </span>
            </PageLink>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex h-full min-h-[inherit] flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {photo ? (
          <ResponsiveImage
            photo={photo}
            sizes="(max-width: 767px) 82vw, 360px"
            priority={index < 2}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black/10 text-sm opacity-70">
            Page image
          </div>
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      </div>
      <div className="relative shrink-0 px-6 py-6 sm:px-7 sm:py-7">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] opacity-55">
          {String(index + 1).padStart(2, "0")}
        </p>
        <h3 className="text-balance font-serif text-2xl font-semibold leading-[1.02] sm:text-3xl">
          {page.headline || `Page ${index + 1}`}
        </h3>
        {page.subhead && (
          <p className="mt-3 text-sm leading-relaxed opacity-78">{page.subhead}</p>
        )}
        {page.caption && (
          <p className="mt-4 line-clamp-3 text-xs leading-relaxed opacity-62">
            {page.caption}
          </p>
        )}
        {linkLabel && linkHref && (
          <PageLink href={linkHref}>
            <span className="mt-5 inline-flex rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition hover:bg-black/5">
              {linkLabel}
            </span>
          </PageLink>
        )}
      </div>
    </div>
  );
}

function BookPhotoPageContent({
  page,
  index,
  photo,
}: {
  page: BookSliderPage;
  index: number;
  photo?: PhotoDTO;
}) {
  const fullImage = (page.imageMode ?? "editorial") === "full";

  if (fullImage) {
    return (
      <div className="book-slider-photo-leaf relative z-10 h-full min-h-[inherit] overflow-hidden text-white">
        {photo ? (
          <ResponsiveImage
            photo={photo}
            sizes="(max-width: 767px) 82vw, 420px"
            priority={index < 2}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 text-sm opacity-80">
            Page image
          </div>
        )}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/42 via-transparent to-black/12" />
        <p className="absolute bottom-6 left-6 z-10 text-xs font-semibold uppercase tracking-[0.24em] text-white/72">
          {String(index + 1).padStart(2, "0")}
        </p>
      </div>
    );
  }

  return (
    <div className="book-slider-photo-leaf relative z-10 flex h-full min-h-[inherit] flex-col p-7">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[0.85rem] shadow-[0_18px_42px_rgb(0_0_0/0.14)]">
        {photo ? (
          <ResponsiveImage
            photo={photo}
            sizes="(max-width: 767px) 82vw, 420px"
            priority={index < 2}
            className="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-black/10 text-sm opacity-70">
            Page image
          </div>
        )}
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] opacity-55">
        {String(index + 1).padStart(2, "0")}
      </p>
    </div>
  );
}

function BookTextPageContent({
  page,
  index,
}: {
  page: BookSliderPage;
  index: number;
}) {
  const linkLabel = page.linkLabel?.trim();
  const linkHref = page.linkHref?.trim();

  return (
    <div className="book-slider-copy-leaf relative z-10 flex h-full min-h-[inherit] flex-col justify-between px-8 py-9">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-55">
        {String(index + 1).padStart(2, "0")}
      </p>
      <div>
        <h3 className="text-balance font-serif text-3xl font-semibold leading-[1.02] sm:text-4xl">
          {page.headline || `Page ${index + 1}`}
        </h3>
        {page.subhead && (
          <p className="mt-5 text-sm leading-relaxed opacity-78">{page.subhead}</p>
        )}
        {page.caption && (
          <p className="mt-6 line-clamp-6 text-sm leading-relaxed opacity-62">
            {page.caption}
          </p>
        )}
        {linkLabel && linkHref && (
          <PageLink href={linkHref}>
            <span className="mt-7 inline-flex rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition hover:bg-black/5">
              {linkLabel}
            </span>
          </PageLink>
        )}
      </div>
      <span className="h-px w-16 bg-current opacity-25" />
    </div>
  );
}

const BookPage = forwardRef<
  HTMLDivElement,
  {
    page: BookSliderPage;
    index: number;
    photo?: PhotoDTO;
    block: BookSliderBlockData;
    variant?: "single" | "photo" | "copy";
  }
>(function BookPage({ page, index, photo, block, variant = "single" }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "book-slider-page relative overflow-hidden",
        variant === "photo" && "book-slider-page--photo",
        variant === "copy" && "book-slider-page--copy",
        variant !== "copy" &&
          (page.imageMode ?? "editorial") === "full" &&
          "book-slider-page--full",
        block.paperTexture !== false && "book-slider-page--texture",
      )}
      data-density={block.pageStyle === "hard" ? "hard" : undefined}
    >
      {variant === "photo" ? (
        <BookPhotoPageContent page={page} index={index} photo={photo} />
      ) : variant === "copy" ? (
        <BookTextPageContent page={page} index={index} />
      ) : (
        <BookPageContent page={page} index={index} photo={photo} />
      )}
    </div>
  );
});

const BookCover = forwardRef<
  HTMLDivElement,
  {
    block: BookSliderBlockData;
    photo?: PhotoDTO;
    back?: boolean;
  }
>(function BookCover({ block, photo, back = false }, ref) {
  return (
    <div
      ref={ref}
      className="book-slider-cover relative overflow-hidden"
      data-density="hard"
    >
      {photo ? (
        <ResponsiveImage
          photo={photo}
          sizes="(max-width: 767px) 82vw, 420px"
          priority={!back}
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_32%_24%,rgba(255,255,255,0.22),transparent_34%),linear-gradient(140deg,rgba(0,0,0,0.15),rgba(0,0,0,0.62))]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-black/25 via-black/55 to-black/80" />
      <div className="relative z-10 flex h-full flex-col justify-between p-8 text-white">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          {back ? "The end" : "Lookbook"}
        </div>
        <div>
          <h3 className="font-serif text-4xl font-semibold leading-[0.95] sm:text-5xl">
            {back ? block.coverTitle || "Lookbook" : block.coverTitle || "Lookbook"}
          </h3>
          {block.coverSubtitle && (
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/76">
              {block.coverSubtitle}
            </p>
          )}
        </div>
        <p className="text-xs uppercase tracking-[0.22em] text-white/60">
          Click or drag
        </p>
      </div>
    </div>
  );
});

function StaticBookFallback({
  block,
  pages,
  photoMap,
}: {
  block: BookSliderBlockData;
  pages: BookSliderPage[];
  photoMap: Map<string, PhotoDTO>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {pages.map((page, index) => (
        <div
          key={page.id}
          className={cn(
            "book-slider-page relative min-h-[30rem] overflow-hidden rounded-[1.25rem] shadow-xl",
            (page.imageMode ?? "editorial") === "full" && "book-slider-page--full",
            block.paperTexture !== false && "book-slider-page--texture",
          )}
        >
          <BookPageContent
            page={page}
            index={index}
            photo={selectedPhoto(page.photoId, photoMap)}
          />
        </div>
      ))}
    </div>
  );
}

export function BookSliderBlock({
  block,
  photoMap,
}: {
  block: BookSliderBlockData;
  photoMap: Map<string, PhotoDTO>;
}) {
  const [mounted, setMounted] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const bookRef = useRef<PageFlipHandle | null>(null);
  const reduced = useReducedMotion();
  const desktopSpread = useMediaQuery("(min-width: 768px)");
  const pages = useMemo(
    () => (block.pages ?? []).filter((page) => page.headline || page.photoId || page.subhead),
    [block.pages],
  );
  const coverPhoto = selectedPhoto(block.coverPhotoId, photoMap);
  const size = SIZE_CONFIG[block.size ?? "standard"];
  const shadowStrength = Math.max(0, Math.min(1, block.shadowStrength ?? 0.45));
  const hasPages = pages.length > 0;
  const showControls = block.showControls !== false && hasPages && !reduced;
  const readyForFlipbook = mounted && !reduced && desktopSpread !== null;
  const doublePageFrame = desktopSpread === true;
  const displayedPage = doublePageFrame
    ? Math.min(pages.length, Math.max(1, Math.floor((pageIndex - 1) / 2) + 1))
    : Math.min(pages.length, Math.max(1, pageIndex));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPageIndex(0);
  }, [doublePageFrame]);

  const next = useCallback(() => {
    bookRef.current?.pageFlip()?.flipNext("bottom");
  }, []);

  const previous = useCallback(() => {
    bookRef.current?.pageFlip()?.flipPrev("bottom");
  }, []);

  if (!hasPages) {
    return (
      <Container className="py-14 sm:py-20">
        <div className="mx-auto flex min-h-64 max-w-5xl items-center justify-center rounded-lg border border-dashed text-sm text-[hsl(var(--muted-foreground))]">
          Book slider - add pages
        </div>
      </Container>
    );
  }

  const style = {
    "--book-slider-bg": block.backgroundColor || "#f7f1e8",
    "--book-slider-text": block.textColor || "#2d251d",
    "--book-slider-accent": block.accentColor || "#8b5e34",
    "--book-slider-shadow-opacity": shadowStrength,
    "--book-slider-page-width": `${size.width}px`,
    "--book-slider-spread-width": `${size.width * 2}px`,
    "--book-slider-shell-width": `${size.width * 2 + 128}px`,
  } as CSSPropertiesWithVars;

  return (
    <section
      className="book-slider-block bg-[hsl(var(--background))] py-14 text-[hsl(var(--foreground))] sm:py-20"
      style={style}
    >
      <Container>
        {(block.title || block.subtitle) && (
          <div className="mx-auto mb-9 max-w-3xl text-center sm:mb-12">
            {block.title && (
              <h2 className="text-balance font-serif text-4xl font-semibold leading-[1.02] sm:text-5xl">
                {block.title}
              </h2>
            )}
            {block.subtitle && (
              <p className="mx-auto mt-4 max-w-2xl text-balance text-sm leading-relaxed text-[hsl(var(--muted-foreground))] sm:text-base">
                {block.subtitle}
              </p>
            )}
          </div>
        )}

        <div
          className={cn(
            "book-slider-shell relative mx-auto rounded-[2rem] px-3 py-7 sm:px-8 sm:py-10",
            size.maxWidth,
          )}
        >
          {!readyForFlipbook ? (
            <StaticBookFallback block={block} pages={pages} photoMap={photoMap} />
          ) : (
            <div className="relative flex justify-center">
              <div
                className={cn(
                  "book-slider-frame",
                  doublePageFrame
                    ? "book-slider-frame--spread"
                    : "book-slider-frame--single",
                )}
              >
                <HTMLFlipBook
                  key={doublePageFrame ? "spread" : "single"}
                  ref={bookRef}
                  width={size.width}
                  height={size.height}
                  size="stretch"
                  minWidth={260}
                  maxWidth={size.width}
                  minHeight={360}
                  maxHeight={size.height}
                  startPage={0}
                  drawShadow
                  flippingTime={950}
                  usePortrait
                  startZIndex={10}
                  autoSize
                  maxShadowOpacity={shadowStrength}
                  showCover
                  mobileScrollSupport
                  clickEventForward
                  useMouseEvents
                  swipeDistance={24}
                  showPageCorners
                  disableFlipByClick={false}
                  className="book-slider-flipbook"
                  style={{}}
                  onFlip={(event) => setPageIndex(Number(event.data) || 0)}
                >
                  <BookCover block={block} photo={coverPhoto} />
                  {doublePageFrame
                    ? pages.flatMap((page, index) => [
                        <BookPage
                          key={`${page.id}-photo`}
                          page={page}
                          index={index}
                          photo={selectedPhoto(page.photoId, photoMap)}
                          block={block}
                          variant="photo"
                        />,
                        <BookPage
                          key={`${page.id}-copy`}
                          page={page}
                          index={index}
                          block={block}
                          variant="copy"
                        />,
                      ])
                    : pages.map((page, index) => (
                        <BookPage
                          key={page.id}
                          page={page}
                          index={index}
                          photo={selectedPhoto(page.photoId, photoMap)}
                          block={block}
                        />
                      ))}
                  <BookCover block={block} photo={coverPhoto} back />
                </HTMLFlipBook>
              </div>

              {showControls && (
                <>
                  <button
                    type="button"
                    className="book-slider-control book-slider-control--prev"
                    onClick={previous}
                    aria-label="Previous page"
                  >
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="book-slider-control book-slider-control--next"
                    onClick={next}
                    aria-label="Next page"
                  >
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          )}

          {block.showPageNumbers !== false && !reduced && (
            <div className="mt-6 flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--book-slider-effective-text)] opacity-70">
              <span>{String(displayedPage).padStart(2, "0")}</span>
              <span className="h-px w-10 bg-current opacity-35" />
              <span>{String(pages.length).padStart(2, "0")}</span>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
