"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";

export interface ToraMinimalSliderItem {
  id: string;
  subtitle: string;
  headline: string;
  buttonLabel: string;
  buttonHref: string;
  photo?: PhotoDTO;
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function SliderLink({
  href,
  className,
  tabIndex,
  children,
}: {
  href?: string | null;
  className?: string;
  tabIndex?: number;
  children: ReactNode;
}) {
  const cleanHref = (href ?? "").trim();
  if (!cleanHref || cleanHref === "#") {
    return (
      <span className={className} tabIndex={tabIndex}>
        {children}
      </span>
    );
  }
  if (isExternalHref(cleanHref)) {
    return (
      <a
        href={cleanHref}
        className={className}
        target="_blank"
        rel="noreferrer noopener"
        tabIndex={tabIndex}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={cleanHref} className={className} tabIndex={tabIndex}>
      {children}
    </Link>
  );
}

export function ToraMinimalSlider({
  items,
  height,
}: {
  items: ToraMinimalSliderItem[];
  height: "short" | "tall" | "full";
}) {
  const slides = useMemo(
    () =>
      items.length > 0
        ? items
        : [
            {
              id: "empty",
              subtitle: "for couples",
              headline: "Another way",
              buttonLabel: "Read More",
              buttonHref: "#",
            },
          ],
    [items],
  );
  const [active, setActive] = useState(0);
  const max = slides.length;

  useEffect(() => {
    setActive((current) => (current >= max ? 0 : current));
  }, [max]);

  const go = useCallback(
    (direction: -1 | 1) => {
      setActive((current) => (current + direction + max) % max);
    },
    [max],
  );

  return (
    <section className={cn("tora-minimal-slider", `tora-minimal-slider--${height}`)}>
      <div className="tora-minimal-slider__stage" aria-roledescription="carousel">
        <div className="tora-minimal-slider__viewport">
          {slides.map((slide, index) => {
            const isActive = index === active;
            return (
              <article
                key={slide.id}
                className={cn("tora-minimal-slider__slide", isActive && "is-active")}
                aria-hidden={!isActive}
              >
                {slide.photo ? (
                  <ResponsiveImage
                    photo={slide.photo}
                    sizes="(max-width: 768px) calc(100vw - 32px), calc(100vw - 18rem)"
                    priority={index === 0}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-[hsl(var(--muted))]" />
                )}
                <div className="tora-minimal-slider__shade" aria-hidden="true" />
                <div className="tora-minimal-slider__caption">
                  {slide.subtitle.trim() && (
                    <p className="tora-minimal-slider__subtitle">{slide.subtitle}</p>
                  )}
                  {slide.headline.trim() && (
                    <h1 className="tora-minimal-slider__title">{slide.headline}</h1>
                  )}
                  {slide.buttonLabel.trim() && (
                    <SliderLink
                      href={slide.buttonHref}
                      className="tora-minimal-slider__button"
                      tabIndex={isActive ? undefined : -1}
                    >
                      {slide.buttonLabel}
                    </SliderLink>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {slides.length > 1 && (
          <>
            <button
              type="button"
              className="tora-minimal-slider__arrow is-prev"
              onClick={() => go(-1)}
              aria-label="Previous slide"
            >
              <span aria-hidden="true" />
            </button>
            <button
              type="button"
              className="tora-minimal-slider__arrow is-next"
              onClick={() => go(1)}
              aria-label="Next slide"
            >
              <span aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
