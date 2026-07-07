"use client";

import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";

export interface ToraParallaxShowcaseItem {
  id: string;
  title: string;
  description?: string | null;
  linkLabel?: string | null;
  linkHref?: string | null;
  photo?: PhotoDTO;
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function ctaLabel(label?: string | null) {
  const clean = (label ?? "").trim();
  if (!clean || clean.toLowerCase() === "read more") return "SEE MORE";
  return clean;
}

function ShowcaseLink({
  href,
  className,
  children,
  ...props
}: {
  href?: string | null;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  const cleanHref = (href ?? "").trim();
  if (!cleanHref || cleanHref === "#") {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  }
  if (isExternalHref(cleanHref)) {
    return (
      <a
        href={cleanHref}
        className={className}
        target="_blank"
        rel="noreferrer noopener"
        {...props}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={cleanHref} className={className} {...props}>
      {children}
    </Link>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ToraParallaxShowcase({ items }: { items: ToraParallaxShowcaseItem[] }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-tora-parallax-panel]"));
    const contents = Array.from(
      root.querySelectorAll<HTMLElement>("[data-tora-parallax-content]"),
    );
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 768px)");
    let frame = 0;

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.18 },
    );

    contents.forEach((content) => revealObserver.observe(content));

    const update = () => {
      frame = 0;
      if (reduceMotion.matches) {
        panels.forEach((panel) => {
          panel.style.removeProperty("--tora-parallax-y");
        });
        return;
      }

      const viewportHeight = window.innerHeight || 1;
      const mobileView = mobile.matches;
      panels.forEach((panel, index) => {
        const rect = panel.getBoundingClientRect();
        const centerOffset = (rect.top + rect.height / 2 - viewportHeight / 2) / viewportHeight;
        const strength = mobileView ? (index % 2 ? 82 : 46) : index % 2 ? 142 : 68;
        const y = clamp(centerOffset, -1.05, 1.05) * strength * -1;
        panel.style.setProperty("--tora-parallax-y", `${y.toFixed(2)}px`);
      });
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    const syncMotionState = () => {
      root.classList.toggle("is-reduced-motion", reduceMotion.matches);
      root.classList.toggle("is-enhanced", !reduceMotion.matches);
      schedule();
    };

    syncMotionState();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduceMotion.addEventListener?.("change", syncMotionState);
    mobile.addEventListener?.("change", schedule);

    return () => {
      revealObserver.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduceMotion.removeEventListener?.("change", syncMotionState);
      mobile.removeEventListener?.("change", schedule);
    };
  }, []);

  return (
    <div className="tora-parallax-showcase" ref={rootRef}>
      {items.map((item, index) => (
        <article
          className={cn("tora-parallax-showcase__panel", index % 2 === 0 ? "is-left" : "is-right")}
          data-tora-parallax-panel
          key={item.id}
        >
          <div className="tora-parallax-showcase__media" aria-hidden="true">
            {item.photo ? (
              <ResponsiveImage
                photo={item.photo}
                sizes="100vw"
                priority={index === 0}
                className="h-full w-full"
              />
            ) : (
              <div className="tora-parallax-showcase__placeholder" />
            )}
          </div>
          <div className="tora-parallax-showcase__shade" aria-hidden="true" />
          <ShowcaseLink
            href={item.linkHref}
            className="tora-parallax-showcase__content"
            data-tora-parallax-content
          >
            <h3 className="tora-parallax-showcase__title">
              <span className="tora-parallax-showcase__title-line">
                <span className="tora-parallax-showcase__title-text">
                  {item.title || `Project ${index + 1}`}
                </span>
                <span className="tora-parallax-showcase__title-mask" aria-hidden="true" />
              </span>
            </h3>
            {item.description && (
              <p className="tora-parallax-showcase__desc">{item.description}</p>
            )}
            <span className="tora-parallax-showcase__cta">{ctaLabel(item.linkLabel)}</span>
          </ShowcaseLink>
        </article>
      ))}
    </div>
  );
}
