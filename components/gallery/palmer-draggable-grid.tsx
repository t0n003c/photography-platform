"use client";

/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { Flip } from "gsap/Flip";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";

type Density = "compact" | "normal" | "wide";
type ItemSize = "small" | "medium" | "large";

type CssVars = React.CSSProperties & {
  "--palmer-bg"?: string;
  "--palmer-text"?: string;
};

interface PalmerPhoto {
  photo: PhotoDTO;
  sourceIndex: number;
  key: string;
}

const SIZE_CLASS: Record<ItemSize, string> = {
  small: "palmer-grid--small",
  medium: "palmer-grid--medium",
  large: "palmer-grid--large",
};

const DENSITY_CLASS: Record<Density, string> = {
  compact: "palmer-grid--compact",
  normal: "palmer-grid--normal",
  wide: "palmer-grid--wide",
};

const DEFAULT_PALMER_BACKGROUND = "#f1f1f1";
const DEFAULT_PALMER_TEXT = "#313131";

function bestImageUrl(photo: PhotoDTO): string | null {
  const webp = photo.variants
    .filter((variant) => variant.format === "webp")
    .sort((a, b) => b.width - a.width)[0];
  const jpeg = photo.variants
    .filter((variant) => variant.format === "jpeg")
    .sort((a, b) => b.width - a.width)[0];
  return webp?.url ?? jpeg?.url ?? null;
}

function imageTitle(photo: PhotoDTO, index: number) {
  return photo.altText || photo.caption || `Image ${index + 1}`;
}

function imageText(photo: PhotoDTO) {
  return (
    photo.caption ||
    photo.altText ||
    "A selected frame from this collection, ready for closer viewing."
  );
}

function buildField(photos: PhotoDTO[]) {
  const cols = 10;
  const rows = 5;
  const pattern = [2, 6, 0, 4, 1, 3, 5, 2, 6, 0, 4, 1, 3, 5, 0, 2, 4, 1, 5, 3];
  const columns: PalmerPhoto[][] = [];
  if (photos.length === 0) return columns;
  for (let col = 0; col < cols; col += 1) {
    const column: PalmerPhoto[] = [];
    for (let row = 0; row < rows; row += 1) {
      const patternIndex = pattern[(col * rows + row) % pattern.length] % photos.length;
      const photo = photos[patternIndex];
      column.push({
        photo,
        sourceIndex: patternIndex,
        key: `${photo.id}-${col}-${row}`,
      });
    }
    columns.push(column);
  }
  return columns;
}

export function PalmerDraggableGrid({
  photos,
  title,
  subtitle,
  density = "normal",
  itemSize = "medium",
  showDetails = true,
  useCustomColors = false,
  backgroundColor = DEFAULT_PALMER_BACKGROUND,
  textColor = DEFAULT_PALMER_TEXT,
  onOpen,
}: {
  photos: PhotoDTO[];
  title?: string;
  subtitle?: string | null;
  density?: Density;
  itemSize?: ItemSize;
  showDetails?: boolean;
  useCustomColors?: boolean;
  backgroundColor?: string;
  textColor?: string;
  onOpen: (index: number) => void;
}) {
  const rootRef = React.useRef<HTMLElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const detailsRef = React.useRef<HTMLDivElement>(null);
  const thumbRef = React.useRef<HTMLDivElement>(null);
  const crossRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<Draggable | null>(null);
  const isDraggingRef = React.useRef(false);
  const isDetailAnimatingRef = React.useRef(false);
  const currentCloneRef = React.useRef<HTMLDivElement | null>(null);
  const activeProductRef = React.useRef<HTMLElement | null>(null);
  const selectedRef = React.useRef<PalmerPhoto | null>(null);
  const gridOpenXRef = React.useRef<number | null>(null);
  const field = React.useMemo(() => buildField(photos), [photos]);
  const [selected, setSelected] = React.useState<PalmerPhoto | null>(null);
  const [thumbSettled, setThumbSettled] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  React.useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    const grid = gridRef.current;
    if (!root || !grid) return;

    gsap.registerPlugin(Draggable, Flip);
    const ctx = gsap.context(() => {
      const products = gsap.utils.toArray<HTMLElement>("[data-palmer-product]", root);
      const centerGrid = () => {
        const centerX = (window.innerWidth - grid.offsetWidth) / 2;
        const centerY = (window.innerHeight - grid.offsetHeight) / 2;
        gsap.set(grid, { x: centerX, y: centerY });
      };
      const bounds = () => ({
        minX: -(grid.offsetWidth - window.innerWidth) - 200,
        maxX: 200,
        minY: -(grid.offsetHeight - window.innerHeight) - 100,
        maxY: 100,
      });
      centerGrid();
      gsap.set(grid, { scale: 0.5, transformOrigin: "50% 50%" });
      gsap.set(products, { scale: 0.5, opacity: 0 });
      gsap
        .timeline({
          onComplete: () => {
            root.classList.add("palmer-grid--loaded");
            dragRef.current = Draggable.create(grid, {
              type: "x,y",
              bounds: bounds(),
              allowEventDefault: true,
              edgeResistance: 0.9,
              onDragStart: () => {
                isDraggingRef.current = true;
                grid.classList.add("palmer-grid__field--dragging");
              },
              onDragEnd: () => {
                window.setTimeout(() => {
                  isDraggingRef.current = false;
                }, 80);
                grid.classList.remove("palmer-grid__field--dragging");
              },
            })[0];
          },
        })
        .to(products, {
          scale: 1,
          opacity: 1,
          duration: 0.6,
          ease: "power3.out",
          stagger: { amount: 1.2, from: "random" },
        })
        .to(grid, { scale: 1, duration: 1.2, ease: "power3.inOut" }, 0.42);

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.target === currentCloneRef.current) return;
            gsap.to(entry.target, {
              opacity: entry.isIntersecting ? 1 : 0,
              scale: entry.isIntersecting ? 1 : 0.5,
              duration: 0.5,
              ease: entry.isIntersecting ? "power2.out" : "power2.in",
            });
          });
        },
        { threshold: 0.1 },
      );
      products.forEach((product) => observer.observe(product));

      const onWheel = (event: WheelEvent) => {
        if (!dragRef.current || selectedRef.current || isDetailAnimatingRef.current) return;
        event.preventDefault();
        const currentX = Number(gsap.getProperty(grid, "x"));
        const currentY = Number(gsap.getProperty(grid, "y"));
        const nextX = currentX - event.deltaX * 7;
        const nextY = currentY - event.deltaY * 7;
        const nextBounds = dragRef.current.vars.bounds as {
          minX: number;
          maxX: number;
          minY: number;
          maxY: number;
        };
        gsap.to(grid, {
          x: Math.max(nextBounds.minX, Math.min(nextBounds.maxX, nextX)),
          y: Math.max(nextBounds.minY, Math.min(nextBounds.maxY, nextY)),
          duration: 0.3,
          ease: "power3.out",
        });
      };
      const onResize = () => {
        if (dragRef.current) dragRef.current.vars.bounds = bounds();
      };
      root.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("resize", onResize);
      return () => {
        observer.disconnect();
        root.removeEventListener("wheel", onWheel);
        window.removeEventListener("resize", onResize);
        dragRef.current?.kill();
        dragRef.current = null;
      };
    }, root);

    return () => ctx.revert();
  }, [reducedMotion]);

  React.useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;
    if (selected) details.scrollTop = 0;
    if (!selected) setThumbSettled(false);
    gsap.to(details, {
      x: selected ? 0 : "100%",
      duration: selected ? 1.2 : 1.2,
      delay: selected ? 0 : 0.3,
      ease: "power3.inOut",
    });
    if (gridRef.current) {
      if (selected) {
        gridOpenXRef.current = Number(gsap.getProperty(gridRef.current, "x"));
        gsap.to(gridRef.current, {
          x: gridOpenXRef.current - window.innerWidth * 0.5,
          duration: 1.2,
          ease: "power3.inOut",
        });
      } else if (gridOpenXRef.current != null) {
        gsap.to(gridRef.current, {
          x: gridOpenXRef.current,
          duration: 1.2,
          delay: 0.3,
          ease: "power3.inOut",
          onComplete: () => {
            gridOpenXRef.current = null;
          },
        });
      }
    }
    gsap.to(crossRef.current, {
      scale: selected ? 1 : 0,
      duration: 0.4,
      delay: selected ? 0.5 : 0,
      ease: selected ? "power2.out" : "power2.in",
    });
  }, [selected]);

  const openDetails = React.useCallback(
    (item: PalmerPhoto, event: React.MouseEvent<HTMLButtonElement>) => {
      if (isDraggingRef.current) return;
      if (!showDetails) {
        onOpen(item.sourceIndex);
        return;
      }
      setThumbSettled(false);
      const target = event.currentTarget.querySelector<HTMLElement>("[data-palmer-product]");
      const thumb = thumbRef.current;
      if (!target || !thumb) {
        setSelected(item);
        return;
      }
      setSelected(item);
      window.requestAnimationFrame(() => {
        const image = target.querySelector("img")?.cloneNode(true) as HTMLImageElement | null;
        if (!image || !thumbRef.current || !detailsRef.current) return;
        const clone = document.createElement("div");
        clone.className = "palmer-grid__flip-thumb";
        clone.appendChild(image);
        document.body.appendChild(clone);
        currentCloneRef.current = clone;
        activeProductRef.current?.classList.remove("palmer-grid__product-thumb--in-detail");
        activeProductRef.current = target;
        target.classList.add("palmer-grid__product-thumb--in-detail");
        const start = target.getBoundingClientRect();
        const end = thumbRef.current.getBoundingClientRect();
        const detailTransform = getComputedStyle(detailsRef.current).transform;
        const detailMatrix =
          detailTransform === "none" ? null : new DOMMatrixReadOnly(detailTransform);
        const detailTx = detailMatrix?.m41 ?? 0;
        const detailTy = detailMatrix?.m42 ?? 0;
        gsap.set(clone, {
          position: "fixed",
          zIndex: 80,
          left: start.left,
          top: start.top,
          width: start.width,
          height: start.height,
        });
        gsap.to(clone, {
          left: end.left - detailTx,
          top: end.top - detailTy,
          width: end.width,
          height: end.height,
          duration: 1.2,
          ease: "power3.inOut",
          onComplete: () => {
            setThumbSettled(true);
            clone.remove();
            currentCloneRef.current = null;
          },
        });
      });
    },
    [onOpen, showDetails],
  );

  const closeDetails = React.useCallback(() => {
    if (!selectedRef.current) return;
    const origin = activeProductRef.current;
    const thumb = thumbRef.current;
    const image = thumb?.querySelector("img")?.cloneNode(true) as HTMLImageElement | null;
    if (!origin || !thumb || !image) {
      origin?.classList.remove("palmer-grid__product-thumb--in-detail");
      activeProductRef.current = null;
      setSelected(null);
      return;
    }

    const clone = document.createElement("div");
    clone.className = "palmer-grid__flip-thumb palmer-grid__flip-thumb--return";
    clone.appendChild(image);
    document.body.appendChild(clone);
    currentCloneRef.current = clone;
    isDetailAnimatingRef.current = true;

    const start = thumb.getBoundingClientRect();
    const end = origin.getBoundingClientRect();
    const returnDx = gridOpenXRef.current != null ? window.innerWidth * 0.5 : 0;
    gsap.set(clone, {
      position: "fixed",
      zIndex: 80,
      left: start.left,
      top: start.top,
      width: start.width,
      height: start.height,
    });

    setThumbSettled(false);
    setSelected(null);
    gsap.to(clone, {
      left: end.left + returnDx,
      top: end.top,
      width: end.width,
      height: end.height,
      duration: 1.2,
      delay: 0.3,
      ease: "power3.inOut",
      onComplete: () => {
        origin.classList.remove("palmer-grid__product-thumb--in-detail");
        clone.remove();
        currentCloneRef.current = null;
        activeProductRef.current = null;
        isDetailAnimatingRef.current = false;
      },
    });
  }, []);

  const onMouseMove = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (!selected || !crossRef.current || !rootRef.current) return;
    const rootRect = rootRef.current.getBoundingClientRect();
    gsap.to(crossRef.current, {
      left: event.clientX - rootRect.left - crossRef.current.offsetWidth / 2,
      top: event.clientY - rootRect.top - crossRef.current.offsetHeight / 2,
      duration: 0.4,
      ease: "power2.out",
    });
  }, [selected]);

  if (reducedMotion) {
    return (
      <section
        className="palmer-grid-fallback px-4 py-12"
        style={{ backgroundColor, color: textColor }}
      >
        <div className="mx-auto max-w-7xl">
          <h1 className="text-4xl font-semibold tracking-tight">{title || "Gallery"}</h1>
          {subtitle && <p className="mt-2 max-w-2xl opacity-70">{subtitle}</p>}
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {photos.map((photo, index) => {
              const src = bestImageUrl(photo);
              return (
                <button
                  key={photo.id}
                  type="button"
                  className="aspect-square overflow-hidden rounded-md bg-black/5"
                  onClick={() => onOpen(index)}
                >
                  {src && (
                    <img
                      src={src}
                      alt={photo.altText ?? ""}
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  const style: CssVars = {
    ...(useCustomColors
      ? {
          "--palmer-bg": backgroundColor,
          "--palmer-text": textColor,
        }
      : {}),
  };

  return (
    <section
      ref={rootRef}
      className={cn(
        "palmer-grid",
        SIZE_CLASS[itemSize],
        DENSITY_CLASS[density],
        selected && "palmer-grid--details-showing",
      )}
      style={style}
      onMouseMove={onMouseMove}
    >
      <div className="palmer-grid__masthead" aria-hidden={selected ? "true" : "false"}>
        <p>{title || "Gallery"}</p>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <div ref={gridRef} className="palmer-grid__field">
        {field.map((column, columnIndex) => (
          <div key={columnIndex} className="palmer-grid__column">
            {column.map((item) => {
              const src = bestImageUrl(item.photo);
              return (
                <button
                  key={item.key}
                  type="button"
                  className="palmer-grid__product"
                  onClick={(event) => openDetails(item, event)}
                  aria-label={`Open ${imageTitle(item.photo, item.sourceIndex)}`}
                >
                  <div data-palmer-product data-photo-id={item.photo.id}>
                    {src && (
                      <img
                        src={src}
                        alt={item.photo.altText ?? ""}
                        draggable={false}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <aside ref={detailsRef} className="palmer-grid__details" aria-hidden={!selected}>
        <div className="palmer-grid__details-title">
          <p>{selected ? imageTitle(selected.photo, selected.sourceIndex) : ""}</p>
        </div>
        <div className="palmer-grid__details-body">
          <div
            ref={thumbRef}
            className={cn(
              "palmer-grid__details-thumb",
              thumbSettled && "palmer-grid__details-thumb--settled",
            )}
          >
            {selected && bestImageUrl(selected.photo) && (
              <img
                src={bestImageUrl(selected.photo) ?? ""}
                alt={selected.photo.altText ?? ""}
              />
            )}
          </div>
          <div className="palmer-grid__details-text">
            <p>{selected ? imageText(selected.photo) : ""}</p>
            {selected && (
              <button type="button" onClick={() => onOpen(selected.sourceIndex)}>
                View full image
              </button>
            )}
          </div>
        </div>
      </aside>
      <button
        type="button"
        className="palmer-grid__close-hit"
        aria-label="Close details"
        onClick={closeDetails}
        hidden={!selected}
      />
      <div ref={crossRef} className="palmer-grid__cross" aria-hidden="true">
        <span />
        <span />
      </div>
    </section>
  );
}
