"use client";

import * as React from "react";
import gsap from "gsap";
import Flip from "gsap/Flip";
import { cn } from "@/src/lib/utils";

gsap.registerPlugin(Flip);

type FlipRevealItemProps = {
  flipKey: string;
} & React.ComponentProps<"div">;

export function FlipRevealItem({ flipKey, ...props }: FlipRevealItemProps) {
  return <div data-flip={flipKey} {...props} />;
}

type FlipRevealProps = {
  keys: string[];
  showClass?: string;
  hideClass?: string;
} & React.ComponentProps<"div">;

function classTokens(value: string) {
  return value.split(/\s+/).filter(Boolean);
}

export function FlipReveal({
  keys,
  hideClass = "",
  showClass = "",
  className,
  ...props
}: FlipRevealProps) {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const firstRunRef = React.useRef(true);
  const keysKey = keys.join("\u0000");

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const items = gsap.utils.toArray<HTMLDivElement>("[data-flip]", wrapper);
    const activeKeys = new Set(keysKey.split("\u0000").filter(Boolean));
    const showTokens = classTokens(showClass);
    const hideTokens = classTokens(hideClass);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const isShow = (value: string | null) => {
      const itemKeys = (value ?? "").split("|").filter(Boolean);
      return activeKeys.has("all") || itemKeys.some((key) => activeKeys.has(key));
    };
    const applyVisibility = () => {
      items.forEach((item) => {
        if (isShow(item.getAttribute("data-flip"))) {
          if (showTokens.length) item.classList.add(...showTokens);
          if (hideTokens.length) item.classList.remove(...hideTokens);
        } else {
          if (showTokens.length) item.classList.remove(...showTokens);
          if (hideTokens.length) item.classList.add(...hideTokens);
        }
      });
    };

    if (reduce) {
      applyVisibility();
      return;
    }

    const state = Flip.getState(items);
    applyVisibility();
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }

    const tween = Flip.from(state, {
      duration: 0.6,
      scale: true,
      ease: "power1.inOut",
      stagger: 0.05,
      absolute: true,
      onEnter: (elements) =>
        gsap.fromTo(
          elements,
          { opacity: 0, scale: 0 },
          { opacity: 1, scale: 1, duration: 0.8 },
        ),
      onLeave: (elements) =>
        gsap.to(elements, { opacity: 0, scale: 0, duration: 0.8 }),
    });

    return () => {
      tween.kill();
    };
  }, [hideClass, keysKey, showClass]);

  return <div {...props} ref={wrapperRef} className={cn(className)} />;
}
