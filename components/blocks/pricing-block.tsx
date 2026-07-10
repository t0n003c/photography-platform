"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Check, CheckCircleIcon, Info, Play, StarIcon, X } from "lucide-react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { Container } from "@/components/ui/container";
import { cn } from "@/src/lib/utils";
import type { LeafBlock } from "@/src/lib/blocks";
import type { PhotoDTO } from "@/src/db/queries/photos";

type PricingBlockData = Extract<LeafBlock, { type: "pricing" }>;
type PricingPlan = PricingBlockData["plans"][number];
type Frequency = "monthly" | "yearly";
type PhotoMap = Map<string, PhotoDTO>;
type PriceRequestStatus = "idle" | "sending" | "sent" | "error";
type CSSPropertiesWithVars = CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

const frequencies: Frequency[] = ["monthly", "yearly"];
const DEFAULT_PRICING_TITLE = "Plans that Scale with You";
const DEFAULT_PRICING_DESCRIPTION =
  "Whether you're just starting out or growing fast, our flexible pricing has you covered - with no hidden costs.";
const DEFAULT_PLAN_INFO = "For most clients";
const toraPricingStyles = [
  "tora-classic",
  "tora-creative",
  "tora-modern",
  "tora-simple",
  "tora-with-media",
  "tora-image-background",
] as const;
type ToraPricingStyle = (typeof toraPricingStyles)[number];

function formatPrice(value: number, currency: string) {
  if (!Number.isFinite(value)) return `${currency}0`;
  return `${currency}${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)}`;
}

function discountFor(plan: PricingPlan) {
  if (plan.priceLabel.trim()) return 0;
  const monthlyYear = plan.monthlyPrice * 12;
  if (!monthlyYear || plan.yearlyPrice >= monthlyYear) return 0;
  return Math.round(((monthlyYear - plan.yearlyPrice) / monthlyYear) * 100);
}

function displayPrice(plan: PricingPlan, frequency: Frequency, currency: string) {
  const custom = plan.priceLabel.trim();
  if (custom) return custom;
  return formatPrice(
    frequency === "yearly" ? plan.yearlyPrice : plan.monthlyPrice,
    currency,
  );
}

function clampNumber(value: number | undefined, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value as number));
}

function priceValue(plan: PricingPlan, frequency: Frequency) {
  const value = frequency === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  return Number.isFinite(value) ? value : 0;
}

function filteredPlans(plans: PricingPlan[]) {
  return plans.filter(
    (plan) =>
      plan.name.trim() ||
      plan.info.trim() ||
      plan.features.some((feature) => feature.text.trim()),
  );
}

function usePricingDarkMode(theme: PricingBlockData["theme"]) {
  const {
    forcedTheme,
    resolvedTheme,
    systemTheme,
    theme: selectedTheme,
  } = useTheme();
  const [fallbackSystemDark, setFallbackSystemDark] = useState(false);

  useEffect(() => {
    if (theme !== "auto") return;
    const sync = () => {
      if (document.documentElement.classList.contains("dark")) {
        setFallbackSystemDark(true);
        return;
      }
      if (document.documentElement.classList.contains("light")) {
        setFallbackSystemDark(false);
        return;
      }
      setFallbackSystemDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    };
    sync();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      media.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, [theme]);

  if (theme === "dark") return true;
  if (theme === "light") return false;

  const activeTheme =
    forcedTheme ??
    resolvedTheme ??
    (selectedTheme === "system" ? systemTheme : selectedTheme);
  if (activeTheme === "dark") return true;
  if (activeTheme === "light") return false;
  return fallbackSystemDark;
}

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reducedMotion;
}

function isToraPricingStyle(
  style: PricingBlockData["style"] | undefined,
): style is ToraPricingStyle {
  return toraPricingStyles.includes(style as ToraPricingStyle);
}

function planPhoto(
  photoMap: PhotoMap | undefined,
  plan: PricingPlan,
  key: "photoId" | "mediaPhotoId" = "photoId",
) {
  const id = plan[key];
  return id ? photoMap?.get(id) : undefined;
}

function ToraPlanMedia({
  photo,
  className,
  sizes,
  priority,
}: {
  photo: PhotoDTO | undefined;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("tora-pricing-media overflow-hidden", className)}>
      {photo ? (
        <ResponsiveImage
          photo={photo}
          sizes={sizes}
          priority={priority}
          className="h-full w-full"
        />
      ) : (
        <div
          className="h-full w-full bg-[linear-gradient(135deg,#d6d0c6,#9b9285_45%,#2b2926)]"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function ToraSelectionDot({
  selected,
}: {
  selected: boolean;
}) {
  return (
    <span
      className={cn(
        "tora-price-check inline-flex shrink-0 items-center justify-center rounded-full",
        selected && "is-selected",
      )}
      aria-hidden="true"
    />
  );
}

function ToraPrice({
  plan,
  frequency,
  currency,
}: {
  plan: PricingPlan;
  frequency: Frequency;
  currency: string;
}) {
  const price = displayPrice(plan, frequency, currency);

  return (
    <span className="tora-price-price" aria-label={price}>
      {price.startsWith(currency) && !plan.priceLabel.trim() ? (
        <>
          <span className="currency">{currency}</span>
          <span className="price">{price.slice(currency.length)}</span>
        </>
      ) : (
        <span className="price">{price}</span>
      )}
    </span>
  );
}

function ToraFeatureList({
  plan,
}: {
  plan: PricingPlan;
}) {
  const features = plan.features.filter((feature) => feature.text.trim());
  if (features.length === 0) return null;

  return (
    <ul className="tora-price-list-wrap">
      {features.map((feature) => {
        const included = feature.included !== false;
        return (
          <li
            key={feature.id}
            className={cn(!included && "is-excluded")}
          >
            <Check className="tora-price-feature-icon" aria-hidden="true" />
            <span>{feature.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ToraImage({
  photo,
  className,
  sizes,
  priority,
}: {
  photo: PhotoDTO | undefined;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <ToraPlanMedia
      photo={photo}
      sizes={sizes}
      priority={priority}
      className={cn("tora-price-image", className)}
    />
  );
}

function ToraCardTop({
  plan,
  photo,
  priority,
}: {
  plan: PricingPlan;
  photo: PhotoDTO | undefined;
  priority: boolean;
}) {
  return (
    <div className="tora-price-image-wrap">
      <ToraImage
        photo={photo}
        sizes="(min-width: 992px) 50vw, 100vw"
        priority={priority}
      />
      <h3 className="tora-price-image-title">{plan.name}</h3>
    </div>
  );
}

function ToraPlanMeta({
  plan,
  overlay = false,
}: {
  plan: PricingPlan;
  overlay?: boolean;
}) {
  const info = plan.info.trim();
  return (
    <>
      <h3 className={overlay ? "title" : "tora-price-title"}>{plan.name}</h3>
      {info && <p className={overlay ? "subtitle" : "tora-price-subtitle"}>{info}</p>}
    </>
  );
}

function ToraPricingSliderBlock({
  block,
  plans,
  frequency,
  dark,
  photoMap,
}: {
  block: PricingBlockData;
  plans: PricingPlan[];
  frequency: Frequency;
  dark: boolean;
  photoMap?: PhotoMap;
}) {
  const reducedMotion = useReducedMotionPreference();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const transitionMs = clampNumber(
    block.pricingSliderTransitionMs,
    300,
    3000,
    1500,
  );
  const autoplayMs = clampNumber(
    block.pricingSliderAutoplayMs,
    1200,
    12000,
    5000,
  );
  const overlayOpacity = clampNumber(
    block.pricingSliderOverlayOpacity,
    0,
    0.85,
    0.5,
  );
  const backgroundPhoto = block.pricingSliderBackgroundPhotoId
    ? photoMap?.get(block.pricingSliderBackgroundPhotoId)
    : undefined;
  const eyebrow = block.eyebrow.trim() || "CHOOSE OWN";
  const title =
    block.heading.trim() && block.heading.trim() !== DEFAULT_PRICING_TITLE
      ? block.heading.trim()
      : "PRICING TABLE";
  const cloneCount = plans.length > 1 ? Math.min(4, plans.length) : 0;
  const renderedPlans = useMemo(
    () => (cloneCount > 0 ? [...plans, ...plans.slice(0, cloneCount)] : plans),
    [cloneCount, plans],
  );
  const visibleIndex = plans.length > 0 ? activeIndex % plans.length : 0;

  const syncOffset = useCallback((index: number) => {
    const track = trackRef.current;
    const slide = track?.children[index] as HTMLElement | undefined;
    if (!track || !slide) {
      setOffset(0);
      return;
    }
    setOffset(slide.offsetLeft);
  }, []);

  useEffect(() => {
    setTransitionEnabled(false);
    setActiveIndex(0);
    setOffset(0);
    const frame = window.requestAnimationFrame(() => {
      syncOffset(0);
      setTransitionEnabled(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [plans.length, syncOffset]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => syncOffset(activeIndex));
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, syncOffset]);

  useEffect(() => {
    const track = trackRef.current;
    const sync = () => syncOffset(activeIndex);
    window.addEventListener("resize", sync);
    const observer =
      typeof ResizeObserver !== "undefined" && track
        ? new ResizeObserver(sync)
        : null;
    if (track) observer?.observe(track);
    return () => {
      window.removeEventListener("resize", sync);
      observer?.disconnect();
    };
  }, [activeIndex, syncOffset]);

  useEffect(() => {
    if (plans.length <= 1 || activeIndex < plans.length) return;
    const timer = window.setTimeout(
      () => {
        setTransitionEnabled(false);
        setActiveIndex(0);
        setOffset(0);
        window.requestAnimationFrame(() => setTransitionEnabled(true));
      },
      reducedMotion ? 0 : transitionMs,
    );
    return () => window.clearTimeout(timer);
  }, [activeIndex, plans.length, reducedMotion, transitionMs]);

  useEffect(() => {
    if (
      block.pricingSliderAutoplay === false ||
      paused ||
      reducedMotion ||
      plans.length <= 1
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setTransitionEnabled(true);
      setActiveIndex((current) => current + 1);
    }, autoplayMs);
    return () => window.clearInterval(timer);
  }, [
    autoplayMs,
    block.pricingSliderAutoplay,
    paused,
    plans.length,
    reducedMotion,
  ]);

  return (
    <section
      className={cn(
        "pricing-block tora-pricing-slider",
        dark && "is-dark",
      )}
      style={
        {
          "--tora-pricing-slider-overlay": overlayOpacity,
          "--tora-pricing-slider-speed": reducedMotion ? "0ms" : `${transitionMs}ms`,
        } as CSSPropertiesWithVars
      }
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="tora-pricing-slider__background" aria-hidden="true">
        {backgroundPhoto ? (
          <ResponsiveImage
            photo={backgroundPhoto}
            sizes="100vw"
            priority
            className="h-full w-full"
          />
        ) : (
          <div className="tora-pricing-slider__fallback-bg" />
        )}
      </div>
      <div className="tora-pricing-slider__overlay" aria-hidden="true" />
      <div className="tora-pricing-slider__inner">
        <header
          className={cn(
            "tora-pricing-slider__heading",
            `is-heading-${block.pricingSliderHeadingSize ?? "reference"}`,
            `is-label-${block.pricingSliderEyebrowSize ?? "reference"}`,
          )}
        >
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </header>

        <div
          className="tora-pricing-slider__viewport"
          aria-roledescription="carousel"
          aria-label={title}
        >
          <div
            ref={trackRef}
            className="tora-pricing-slider__track"
            style={
              {
                transform: `translate3d(${-offset}px, 0, 0)`,
                transitionDuration:
                  transitionEnabled && !reducedMotion
                    ? "var(--tora-pricing-slider-speed)"
                    : "0ms",
              } as CSSProperties
            }
          >
            {renderedPlans.map((plan, renderedIndex) => {
              const isClone = renderedIndex >= plans.length;
              const features = plan.features.filter((feature) => feature.text.trim());
              const highlighted = plan.highlighted && !isClone;
              const ctaHref = plan.ctaHref.trim() || "#";
              const ctaLabel = plan.ctaLabel.trim() || "FREE TRIAL";
              return (
                <article
                  key={`${plan.id}-${renderedIndex}`}
                  className={cn(
                    "tora-pricing-slider__slide",
                    highlighted && "is-highlighted",
                  )}
                  aria-hidden={isClone || undefined}
                >
                  <div className="tora-pricing-slider__card">
                    <h3>{plan.name}</h3>
                    <div className="tora-pricing-slider__cost">
                      {displayPrice(plan, frequency, block.currency || "$")}
                    </div>
                    {features.length > 0 && (
                      <ul>
                        {features.map((feature) => (
                          <li
                            key={feature.id}
                            className={cn(feature.included === false && "is-excluded")}
                          >
                            {feature.text}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href={ctaHref}
                      className="tora-pricing-slider__button"
                      tabIndex={isClone ? -1 : 0}
                    >
                      {ctaLabel}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {plans.length > 1 && (
          <div className="tora-pricing-slider__pagination" aria-label="Pricing slides">
            {plans.map((plan, index) => (
              <button
                key={plan.id}
                type="button"
                className={cn(index === visibleIndex && "is-active")}
                aria-label={`Show ${plan.name}`}
                aria-current={index === visibleIndex}
                onClick={() => {
                  setTransitionEnabled(true);
                  setActiveIndex(index);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ToraPricingBlock({
  block,
  plans,
  frequency,
  dark,
  photoMap,
}: {
  block: PricingBlockData;
  plans: PricingPlan[];
  frequency: Frequency;
  dark: boolean;
  photoMap?: PhotoMap;
}) {
  const style = isToraPricingStyle(block.style) ? block.style : "tora-classic";
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    () => plans.find((plan) => plan.highlighted)?.id ?? plans[0]?.id ?? null,
  );

  useEffect(() => {
    if (selectedPlanId && plans.some((plan) => plan.id === selectedPlanId)) {
      return;
    }
    setSelectedPlanId(plans.find((plan) => plan.highlighted)?.id ?? plans[0]?.id ?? null);
  }, [plans, selectedPlanId]);

  const togglePlan = (planId: string) => {
    setSelectedPlanId((current) => (current === planId ? null : planId));
  };
  const selectProps = (plan: PricingPlan) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-pressed": selectedPlanId === plan.id,
    onClick: () => togglePlan(plan.id),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      togglePlan(plan.id);
    },
  });

  if (style === "tora-creative" || style === "tora-simple") {
    const simple = style === "tora-simple";
    return (
      <section
        className={cn(
          "pricing-block tora-price-section",
          dark && "is-dark",
        )}
      >
        <div
          className={cn(
            "tora-pricelist",
            simple ? "tora-pricelist--simple" : "tora-pricelist--creative",
          )}
        >
          {plans.map((plan, index) => {
            const selected = selectedPlanId === plan.id;
            const photo = planPhoto(photoMap, plan);
            return (
              <article
                key={plan.id}
                {...selectProps(plan)}
                className={cn(
                  "pricing-wrap",
                  selected && "active",
                )}
                style={
                  {
                    "--tora-index": index,
                  } as CSSPropertiesWithVars
                }
              >
                <ToraImage
                  photo={photo}
                  sizes="100vw"
                  priority={index === 0}
                  className="tora-price-bg-image"
                />
                <Container className="tora-price-container max-w-[1174px]">
                  {simple ? (
                    <div className="tora-price-simple-grid">
                      <div>
                        <h3 className="title">{plan.name}</h3>
                      </div>
                      <div>
                        <div className="price-wrap">
                          <ToraSelectionDot selected={selected} />
                          <ToraPrice
                            plan={plan}
                            frequency={frequency}
                            currency={block.currency || "$"}
                          />
                        </div>
                        {plan.info && <p className="text">{plan.info}</p>}
                        <p className="subtitle">{plan.name}</p>
                        <ToraFeatureList plan={plan} />
                      </div>
                    </div>
                  ) : (
                    <div className="wrap">
                      <div className="price-wrap">
                        <ToraSelectionDot selected={selected} />
                        <ToraPrice
                          plan={plan}
                          frequency={frequency}
                          currency={block.currency || "$"}
                        />
                      </div>
                      <h3 className="title">{plan.name}</h3>
                      {plan.info && <p className="text">{plan.info}</p>}
                      <p className="subtitle">{plan.name}</p>
                      <ToraFeatureList plan={plan} />
                    </div>
                  )}
                </Container>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  if (style === "tora-with-media") {
    return (
      <section
        className={cn(
          "pricing-block tora-price-section",
          dark && "is-dark",
        )}
      >
        <Container className="max-w-[1174px]">
          <div className="space-y-16">
            {plans.map((plan, index) => {
              const selected = selectedPlanId === plan.id;
              const photo =
                planPhoto(photoMap, plan, "mediaPhotoId") ??
                planPhoto(photoMap, plan);
              const videoUrl = plan.mediaVideoUrl.trim();
              return (
                <article
                  key={plan.id}
                  {...selectProps(plan)}
                  className={cn(
                    "tora-pricelist tora-pricelist--with-media pricing-wrap",
                    selected && "active",
                  )}
                >
                  <div className={cn("media-wrap", videoUrl && "enable-video")}>
                    <ToraImage
                      photo={photo}
                      sizes="(min-width: 992px) 60vw, 100vw"
                      priority={index === 0}
                    />
                    {videoUrl ? (
                      <Link
                        href={videoUrl}
                        onClick={(event) => event.stopPropagation()}
                        className="video-btn"
                      >
                        <Play className="h-8 w-8 fill-current" />
                        <span className="sr-only">Play media</span>
                      </Link>
                    ) : (
                      <span className="video-btn" aria-hidden="true">
                        <Play className="h-8 w-8 fill-current" />
                      </span>
                    )}
                  </div>
                  <div className="pricing-content">
                    <div className="price-wrap">
                      <ToraSelectionDot selected={selected} />
                      <ToraPrice
                        plan={plan}
                        frequency={frequency}
                        currency={block.currency || "$"}
                      />
                    </div>
                    <ToraPlanMeta plan={plan} />
                    <ToraFeatureList plan={plan} />
                  </div>
                </article>
              );
            })}
          </div>
        </Container>
      </section>
    );
  }

  const imageBackground = style === "tora-image-background";
  const modern = style === "tora-modern";

  return (
    <section
      className={cn(
        "pricing-block tora-price-section",
        dark && "is-dark",
      )}
    >
      <Container className="max-w-[1174px]">
        <div
          className={cn(
            "tora-pricelist",
            imageBackground
              ? "tora-pricelist--img-bg"
              : modern
                ? "tora-pricelist--modern"
                : "tora-pricelist--classic",
          )}
        >
          {plans.map((plan, index) => {
            const selected = selectedPlanId === plan.id;
            const photo = planPhoto(photoMap, plan);
            return (
              <article
                key={plan.id}
                {...selectProps(plan)}
                className={cn(
                  "pricing-wrap",
                  selected && "active",
                )}
                style={
                  {
                    "--tora-index": index,
                  } as CSSPropertiesWithVars
                }
              >
                {imageBackground ? (
                  <div className="img-bg-clip">
                    <ToraImage
                      photo={photo}
                      sizes="(min-width: 992px) 33vw, 100vw"
                      priority={index === 0}
                    />
                    <div className="content">
                      <ToraPlanMeta plan={plan} overlay />
                      <ToraFeatureList plan={plan} />
                      <div className="price-wrap">
                        <ToraPrice
                          plan={plan}
                          frequency={frequency}
                          currency={block.currency || "$"}
                        />
                        <ToraSelectionDot selected={selected} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="wrap">
                    {modern ? (
                      <div className="tora-price-image-wrap">
                        <ToraImage
                          photo={photo}
                          sizes="(min-width: 992px) 33vw, 100vw"
                          priority={index === 0}
                        />
                        <div className="wrap-top">
                          <ToraPlanMeta plan={plan} overlay />
                        </div>
                      </div>
                    ) : (
                      <ToraCardTop
                        plan={plan}
                        photo={photo}
                        priority={index === 0}
                      />
                    )}
                    {!modern && (
                      <p className="subtitle">{plan.info || plan.name}</p>
                    )}
                    <ToraFeatureList plan={plan} />
                    <div className="price-wrap">
                      <ToraPrice
                        plan={plan}
                        frequency={frequency}
                        currency={block.currency || "$"}
                      />
                      <ToraSelectionDot selected={selected} />
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function ToraStyle3ContactForm({
  selectedPlans,
  total,
  currency,
  frequency,
}: {
  selectedPlans: PricingPlan[];
  total: number;
  currency: string;
  frequency: Frequency;
}) {
  const formId = useId();
  const [startedAt, setStartedAt] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<PriceRequestStatus>("idle");

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  const closePopup = () => setStatus("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const form = new FormData(event.currentTarget);
    const selectedLines =
      selectedPlans.length > 0
        ? selectedPlans.map(
            (plan) =>
              `- ${plan.name}: ${displayPrice(plan, frequency, currency)}`,
          )
        : ["- No package selected"];
    const message = [
      String(form.get("message") ?? "").trim(),
      "",
      "Selected price-list packages:",
      ...selectedLines,
      `Total: ${formatPrice(total, currency)}`,
    ]
      .join("\n")
      .trim();

    try {
      const response = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          subject:
            selectedPlans.length > 0
              ? `Pricing request: ${selectedPlans.map((plan) => plan.name).join(", ")}`
              : "Pricing request",
          message,
          company: String(form.get("company") ?? ""),
          _ts: startedAt,
        }),
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      event.currentTarget.reset();
      setAgreed(false);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="tora-pricelist-style3-contact">
      <div className="top-wrap">
        <h3 className="title">CONTACT US!</h3>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <div aria-hidden="true" className="absolute left-[-9999px]">
          <label>
            Company
            <input name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <div className="input-wrap">
          <input name="name" type="text" placeholder="Name" autoComplete="name" required />
        </div>
        <div className="input-wrap">
          <input name="email" type="email" placeholder="Email" autoComplete="email" required />
        </div>
        <div className="input-wrap textarea-wrap">
          <textarea name="message" placeholder="Message" rows={5} required />
        </div>
        <div className="button-wrap">
          <div className="term-wrap">
            <label htmlFor={`${formId}-terms`}>
              <input
                id={`${formId}-terms`}
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                required
              />
              <span aria-hidden="true" />
              <span className="term-text">
                I agree with the{" "}
                <a href="#" onClick={(event) => event.preventDefault()}>
                  Term
                </a>
              </span>
            </label>
          </div>
          <button
            className="a-btn-3"
            type="submit"
            disabled={!agreed || status === "sending"}
          >
            {status === "sending" ? "Sending..." : "Submit"}
          </button>
        </div>
      </form>
      {(status === "sent" || status === "error") && (
        <div
          className="reflector-send-popup active"
          role="dialog"
          aria-modal="true"
          aria-live="polite"
        >
          <div className="content">
            <button
              type="button"
              className="close"
              onClick={closePopup}
              aria-label="Close message"
            >
              <span className="line" />
              <span className="line" />
            </button>
            <div className="popup-title">
              {status === "sent" ? "Thank you!" : "Oooops!"}
            </div>
            <p className={status === "sent" ? "done" : "error"}>
              {status === "sent"
                ? "Your message is sent!"
                : "Your message isn't sent!"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ToraStyle1ContactForm({
  selectedPlans,
  total,
  currency,
  frequency,
}: {
  selectedPlans: PricingPlan[];
  total: number;
  currency: string;
  frequency: Frequency;
}) {
  const formId = useId();
  const [startedAt, setStartedAt] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<PriceRequestStatus>("idle");

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  const closePopup = () => setStatus("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const form = new FormData(event.currentTarget);
    const selectedLines =
      selectedPlans.length > 0
        ? selectedPlans.map(
            (plan) =>
              `- ${plan.name}: ${displayPrice(plan, frequency, currency)}`,
          )
        : ["- No package selected"];
    const date = String(form.get("date") ?? "").trim();
    const location = String(form.get("location") ?? "").trim();
    const details = [
      date ? `Preferred date: ${date}` : "",
      location ? `Location: ${location}` : "",
      String(form.get("message") ?? "").trim(),
    ].filter(Boolean);
    const message = [
      ...details,
      "",
      "Selected price-list packages:",
      ...selectedLines,
      `Total: ${formatPrice(total, currency)}`,
    ]
      .join("\n")
      .trim();

    try {
      const response = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          subject:
            selectedPlans.length > 0
              ? `Pricing request: ${selectedPlans.map((plan) => plan.name).join(", ")}`
              : "Pricing request",
          message,
          company: String(form.get("company") ?? ""),
          _ts: startedAt,
        }),
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      event.currentTarget.reset();
      setAgreed(false);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="tora-pricelist-style1-contact">
      <div className="top-wrap">
        <h3 className="title">CONTACT</h3>
        <p>Thanks for choosing me for your future event!</p>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <div aria-hidden="true" className="absolute left-[-9999px]">
          <label>
            Company
            <input name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <input name="name" type="text" placeholder="Name *" autoComplete="name" required />
        <input name="email" type="email" placeholder="Email *" autoComplete="email" required />
        <input name="date" type="text" placeholder="Date" />
        <input name="location" type="text" placeholder="Location" />
        <textarea
          name="message"
          placeholder="List 3 things about you I should know"
          rows={4}
        />
        <div className="button-wrap">
          <div className="term-wrap">
            <label htmlFor={`${formId}-terms`}>
              <input
                id={`${formId}-terms`}
                type="checkbox"
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                required
              />
              <span aria-hidden="true" />
              <span className="term-text">
                I agree with the{" "}
                <a href="#" onClick={(event) => event.preventDefault()}>
                  Term
                </a>
              </span>
            </label>
          </div>
          <button
            className="a-btn-5"
            type="submit"
            disabled={!agreed || status === "sending"}
          >
            {status === "sending" ? "Sending..." : "Submit"}
          </button>
        </div>
      </form>
      {(status === "sent" || status === "error") && (
        <div
          className="reflector-send-popup active"
          role="dialog"
          aria-modal="true"
          aria-live="polite"
        >
          <div className="content">
            <button
              type="button"
              className="close"
              onClick={closePopup}
              aria-label="Close message"
            >
              <span className="line" />
              <span className="line" />
            </button>
            <div className="popup-title">
              {status === "sent" ? "Thank you!" : "Oooops!"}
            </div>
            <p className={status === "sent" ? "done" : "error"}>
              {status === "sent"
                ? "Your message is sent!"
                : "Your message isn't sent!"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ToraPriceListStyle1Block({
  block,
  plans,
  frequency,
  dark,
  photoMap,
}: {
  block: PricingBlockData;
  plans: PricingPlan[];
  frequency: Frequency;
  dark: boolean;
  photoMap?: PhotoMap;
}) {
  const packagePlans = useMemo(() => plans.slice(0, 2), [plans]);
  const featuredPlan = plans[2];
  const editorialPlans = useMemo(() => plans.slice(3), [plans]);
  const currency = block.currency || "$";
  const autoTheme = (block.theme ?? "auto") === "auto";
  const title =
    block.heading.trim() && block.heading.trim() !== DEFAULT_PRICING_TITLE
      ? block.heading.trim()
      : "SAVE YOUR HISTORY";
  const description =
    block.description.trim() && block.description.trim() !== DEFAULT_PRICING_DESCRIPTION
      ? block.description.trim()
      : "";
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string | null>>(
    () => {
      const highlighted = plans.filter((plan) => plan.highlighted);
      return {
        packages:
          highlighted.find((plan) => packagePlans.includes(plan))?.id ??
          packagePlans[0]?.id ??
          null,
        feature:
          highlighted.find((plan) => plan === featuredPlan)?.id ??
          featuredPlan?.id ??
          null,
      };
    },
  );

  useEffect(() => {
    const validPlanIds = new Set(plans.map((plan) => plan.id));
    setSelectedByGroup((current) => {
      let changed = false;
      const next: Record<string, string | null> = {};
      for (const [group, planId] of Object.entries(current)) {
        if (planId && validPlanIds.has(planId)) {
          next[group] = planId;
          continue;
        }
        next[group] = null;
        changed = changed || Boolean(planId);
      }
      if (!("packages" in next)) {
        next.packages = packagePlans[0]?.id ?? null;
        changed = true;
      }
      if (!("feature" in next)) {
        next.feature = featuredPlan?.id ?? null;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [featuredPlan, packagePlans, plans]);

  const selectedIds = useMemo(
    () =>
      new Set(
        Object.values(selectedByGroup).filter(
          (planId): planId is string => Boolean(planId),
        ),
      ),
    [selectedByGroup],
  );
  const selectedPlans = useMemo(
    () => plans.filter((plan) => selectedIds.has(plan.id)),
    [plans, selectedIds],
  );
  const total = selectedPlans.reduce(
    (sum, plan) => sum + priceValue(plan, frequency),
    0,
  );

  const togglePlan = (group: string, planId: string) => {
    setSelectedByGroup((current) => ({
      ...current,
      [group]: current[group] === planId ? null : planId,
    }));
  };

  const selectProps = (plan: PricingPlan, group: string) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-pressed": selectedIds.has(plan.id),
    onClick: () => togglePlan(group, plan.id),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      togglePlan(group, plan.id);
    },
  });

  return (
    <section
      className={cn(
        "pricing-block tora-price-section tora-pricelist-style1",
        autoTheme && "is-auto-theme",
        dark && "is-dark",
      )}
    >
      <Container className="tora-pricelist-style1__heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </Container>

      {packagePlans.length > 0 && (
        <Container className="max-w-[1174px]">
          <div className="tora-pricelist-style1__cards">
            {packagePlans.map((plan, index) => {
              const selected = selectedIds.has(plan.id);
              const note = plan.info.trim();
              return (
                <article
                  key={plan.id}
                  {...selectProps(plan, "packages")}
                  className={cn(
                    "pricing-wrap tora-pricelist-style1__card",
                    selected && "active",
                  )}
                >
                  <div className="wrap">
                    <div className="tora-pricelist-style1__card-image">
                      <ToraImage
                        photo={planPhoto(photoMap, plan)}
                        sizes="(min-width: 768px) 42vw, 100vw"
                        priority={index === 0}
                      />
                      <h3>{plan.name}</h3>
                    </div>
                    {note && note !== DEFAULT_PLAN_INFO && (
                      <p className="tora-pricelist-style1__card-note">{note}</p>
                    )}
                    <p className="subtitle">INCLUDES:</p>
                    <ToraFeatureList plan={plan} />
                    <div className="price-wrap">
                      <ToraPrice
                        plan={plan}
                        frequency={frequency}
                        currency={currency}
                      />
                      <ToraSelectionDot selected={selected} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Container>
      )}

      {featuredPlan && (
        <article
          {...selectProps(featuredPlan, "feature")}
          className={cn(
            "pricing-wrap tora-pricelist-style1__feature",
            selectedIds.has(featuredPlan.id) && "active",
          )}
        >
          <ToraImage
            photo={planPhoto(photoMap, featuredPlan)}
            sizes="100vw"
            priority={packagePlans.length === 0}
            className="tora-price-bg-image"
          />
          <Container className="tora-pricelist-style1__feature-inner max-w-[1174px]">
            <div className="tora-pricelist-style1__feature-copy">
              <div className="price-wrap">
                <ToraSelectionDot selected={selectedIds.has(featuredPlan.id)} />
                <ToraPrice
                  plan={featuredPlan}
                  frequency={frequency}
                  currency={currency}
                />
              </div>
              <h3>{featuredPlan.name}</h3>
              {featuredPlan.info.trim() && (
                <p className="text">{featuredPlan.info}</p>
              )}
              <p className="subtitle">INCLUDES:</p>
              <ToraFeatureList plan={featuredPlan} />
            </div>
          </Container>
        </article>
      )}

      {editorialPlans.length > 0 && (
        <Container className="tora-pricelist-style1__editorial max-w-[1174px]">
          {editorialPlans.map((plan, index) => {
            const ctaHref = plan.ctaHref.trim();
            const showCta = ctaHref && ctaHref !== "#";
            const ctaLabel =
              plan.ctaLabel.trim() && plan.ctaLabel.trim() !== "Get started"
                ? plan.ctaLabel.trim()
                : "READ MORE";
            const photo =
              planPhoto(photoMap, plan, "mediaPhotoId") ?? planPhoto(photoMap, plan);
            const features = plan.features.filter((feature) => feature.text.trim());
            return (
              <article
                key={plan.id}
                className={cn(
                  "tora-pricelist-style1__editorial-row",
                  index % 2 === 1 && "is-reverse",
                )}
              >
                <ToraImage
                  photo={photo}
                  sizes="(min-width: 768px) 42vw, 100vw"
                  priority={false}
                  className="tora-pricelist-style1__editorial-image"
                />
                <div className="tora-pricelist-style1__editorial-copy">
                  <h3>{plan.name}</h3>
                  {plan.info.trim() && <p>{plan.info}</p>}
                  {features.map((feature) => (
                    <p key={feature.id}>{feature.text}</p>
                  ))}
                  {showCta && (
                    <Link href={ctaHref} className="a-btn-3">
                      {ctaLabel}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </Container>
      )}

      <div className="tora-pricelist-style1__contact-band">
        <Container className="max-w-[1174px]">
          <ToraStyle1ContactForm
            selectedPlans={selectedPlans}
            total={total}
            currency={currency}
            frequency={frequency}
          />
        </Container>
      </div>

      <div
        className={cn(
          "tora-pricelist-style1-total",
          selectedPlans.length > 0 && "active",
        )}
        role="status"
        aria-live="polite"
      >
        <span>Total:</span>
        <span className="total-price">{formatPrice(total, currency)}</span>
      </div>
    </section>
  );
}

function ToraPriceListStyle3Block({
  block,
  plans,
  frequency,
  dark,
  photoMap,
}: {
  block: PricingBlockData;
  plans: PricingPlan[];
  frequency: Frequency;
  dark: boolean;
  photoMap?: PhotoMap;
}) {
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string | null>>(
    () => {
      const highlighted = plans.filter((plan) => plan.highlighted);
      return {
        services: highlighted.find((plan) => plans.slice(0, 3).includes(plan))?.id ?? null,
        feature: highlighted.find((plan) => plan === plans[3])?.id ?? null,
        media: highlighted.find((plan) => plan === plans[4])?.id ?? null,
      };
    },
  );

  useEffect(() => {
    const validPlanIds = new Set(plans.map((plan) => plan.id));
    setSelectedByGroup((current) => {
      let changed = false;
      const next: Record<string, string | null> = {};
      for (const [group, planId] of Object.entries(current)) {
        if (planId && validPlanIds.has(planId)) {
          next[group] = planId;
          continue;
        }
        next[group] = null;
        changed = changed || Boolean(planId);
      }
      return changed ? next : current;
    });
  }, [plans]);

  const selectedIds = useMemo(
    () =>
      new Set(
        Object.values(selectedByGroup).filter(
          (planId): planId is string => Boolean(planId),
        ),
      ),
    [selectedByGroup],
  );
  const selectedPlans = useMemo(
    () => plans.filter((plan) => selectedIds.has(plan.id)),
    [plans, selectedIds],
  );
  const total = selectedPlans.reduce(
    (sum, plan) => sum + priceValue(plan, frequency),
    0,
  );

  const togglePlan = (group: string, planId: string) => {
    setSelectedByGroup((current) => ({
      ...current,
      [group]: current[group] === planId ? null : planId,
    }));
  };

  const selectProps = (plan: PricingPlan, group: string) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-pressed": selectedIds.has(plan.id),
    onClick: () => togglePlan(group, plan.id),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      togglePlan(group, plan.id);
    },
  });

  const title =
    block.heading.trim() && block.heading.trim() !== DEFAULT_PRICING_TITLE
      ? block.heading.trim()
      : "PHOTOGRAPHY SERVICES";
  const description =
    block.description.trim() &&
    block.description.trim() !== DEFAULT_PRICING_DESCRIPTION
      ? block.description.trim()
      : "";
  const servicePlans = plans.slice(0, 3);
  const simplePlan = plans[3];
  const mediaPlan = plans[4];
  const currency = block.currency || "$";
  const autoTheme = (block.theme ?? "auto") === "auto";

  return (
    <section
      className={cn(
        "pricing-block tora-price-section tora-pricelist-style3",
        autoTheme && "is-auto-theme",
        dark && "is-dark",
      )}
    >
      <Container className="tora-pricelist-style3-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </Container>

      {servicePlans.length > 0 && (
        <Container className="max-w-[1174px]">
          <div className="tora-pricelist tora-pricelist--modern tora-pricelist-style3-modern">
            {servicePlans.map((plan, index) => {
              const selected = selectedIds.has(plan.id);
              const photo = planPhoto(photoMap, plan);
              return (
                <article
                  key={plan.id}
                  {...selectProps(plan, "services")}
                  className={cn("pricing-wrap", selected && "active")}
                >
                  <div className="wrap">
                    <div className="tora-price-image-wrap">
                      <ToraImage
                        photo={photo}
                        sizes="(min-width: 992px) 33vw, 100vw"
                        priority={index === 0}
                      />
                      <div className="wrap-top">
                        <ToraPlanMeta plan={plan} overlay />
                      </div>
                    </div>
                    <ToraFeatureList plan={plan} />
                    <div className="price-wrap">
                      <ToraPrice
                        plan={plan}
                        frequency={frequency}
                        currency={currency}
                      />
                      <ToraSelectionDot selected={selected} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Container>
      )}

      {simplePlan && (
        <div className="tora-pricelist tora-pricelist--simple tora-pricelist-style3-simple">
          <article
            {...selectProps(simplePlan, "feature")}
            className={cn(
              "pricing-wrap",
              selectedIds.has(simplePlan.id) && "active",
            )}
          >
            <ToraImage
              photo={planPhoto(photoMap, simplePlan)}
              sizes="100vw"
              priority={servicePlans.length === 0}
              className="tora-price-bg-image"
            />
            <Container className="tora-price-container max-w-[1174px]">
              <div className="tora-price-simple-grid">
                <div>
                  <h3 className="title">{simplePlan.name}</h3>
                </div>
                <div>
                  <div className="price-wrap">
                    <ToraSelectionDot selected={selectedIds.has(simplePlan.id)} />
                    <ToraPrice
                      plan={simplePlan}
                      frequency={frequency}
                      currency={currency}
                    />
                  </div>
                  {simplePlan.info && <p className="text">{simplePlan.info}</p>}
                  <p className="subtitle">INCLUDES:</p>
                  <ToraFeatureList plan={simplePlan} />
                </div>
              </div>
            </Container>
          </article>
        </div>
      )}

      {mediaPlan && (
        <Container className="tora-pricelist-style3-media-wrap max-w-[1174px]">
          <article
            {...selectProps(mediaPlan, "media")}
            className={cn(
              "tora-pricelist tora-pricelist--with-media pricing-wrap tora-pricelist-style3-media",
              selectedIds.has(mediaPlan.id) && "active",
            )}
          >
            <div
              className={cn(
                "media-wrap",
                mediaPlan.mediaVideoUrl.trim() && "enable-video",
              )}
            >
              <ToraImage
                photo={
                  planPhoto(photoMap, mediaPlan, "mediaPhotoId") ??
                  planPhoto(photoMap, mediaPlan)
                }
                sizes="(min-width: 992px) 60vw, 100vw"
                priority={servicePlans.length === 0 && !simplePlan}
              />
              {mediaPlan.mediaVideoUrl.trim() ? (
                <Link
                  href={mediaPlan.mediaVideoUrl.trim()}
                  onClick={(event) => event.stopPropagation()}
                  className="video-btn"
                >
                  <Play className="h-8 w-8 fill-current" />
                  <span className="sr-only">Play media</span>
                </Link>
              ) : (
                <span className="video-btn" aria-hidden="true">
                  <Play className="h-8 w-8 fill-current" />
                </span>
              )}
            </div>
            <div className="pricing-content">
              <div className="price-wrap">
                <ToraSelectionDot selected={selectedIds.has(mediaPlan.id)} />
                <ToraPrice
                  plan={mediaPlan}
                  frequency={frequency}
                  currency={currency}
                />
              </div>
              <ToraPlanMeta plan={mediaPlan} />
              <p className="tora-price-subtitle">INCLUDES:</p>
              <ToraFeatureList plan={mediaPlan} />
            </div>
          </article>
        </Container>
      )}

      <Container className="max-w-[1174px]">
        <ToraStyle3ContactForm
          selectedPlans={selectedPlans}
          total={total}
          currency={currency}
          frequency={frequency}
        />
      </Container>

      <div
        className={cn(
          "tora-pricelist-style3-total",
          selectedPlans.length > 0 && "active",
        )}
        role="status"
        aria-live="polite"
      >
        <span>Total:</span>
        <span className="total-price">{formatPrice(total, currency)}</span>
      </div>
    </section>
  );
}

function castingLine(value: string) {
  const text = value.trim();
  if (!text) return "";
  return text.startsWith("/") ? text : `/${text}`;
}

function ToraCastingServicesBlock({
  block,
  plans,
  dark,
  photoMap,
}: {
  block: PricingBlockData;
  plans: PricingPlan[];
  dark: boolean;
  photoMap?: PhotoMap;
}) {
  const rawTitle = block.heading.trim();
  const title =
    rawTitle && rawTitle !== DEFAULT_PRICING_TITLE
      ? rawTitle
      : "OFFERING CASTINGS FOR";
  const rawDescription = block.description.trim();
  const description =
    rawDescription && rawDescription !== DEFAULT_PRICING_DESCRIPTION
      ? rawDescription
      : "";
  const castingImageRatio = block.castingImageRatio ?? "reference";

  return (
    <section
      className={cn(
        "pricing-block tora-price-section tora-casting-services",
        dark && "is-dark",
        `tora-casting-services--ratio-${castingImageRatio}`,
      )}
    >
      <Container className="tora-casting-services__container">
        <div className="tora-casting-services__heading">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>

        <div className="tora-casting-services__list">
          {plans.map((plan, index) => {
            const photo = planPhoto(photoMap, plan);
            const lines = [
              castingLine(plan.info),
              ...plan.features
                .filter((feature) => feature.text.trim())
                .map((feature) => castingLine(feature.text)),
            ].filter(Boolean);

            return (
              <article
                key={plan.id}
                className={cn(
                  "tora-casting-services__row",
                  index % 2 === 1 && "is-reverse",
                )}
              >
                <div className="tora-casting-services__copy">
                  <div className="tora-casting-services__top">
                    <span className="tora-casting-services__number">
                      /{String(index + 1).padStart(2, "0")}
                    </span>
                    <h3>{plan.name}</h3>
                  </div>
                  {lines.length > 0 && (
                    <div className="tora-casting-services__lines">
                      {lines.map((line, lineIndex) => (
                        <p key={lineIndex}>{line}</p>
                      ))}
                    </div>
                  )}
                </div>
                <ToraImage
                  photo={photo}
                  sizes="(min-width: 992px) 48vw, 100vw"
                  priority={index === 0}
                  className="tora-casting-services__image"
                />
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function PricingFrequencyToggle({
  frequency,
  onChange,
  dark,
}: {
  frequency: Frequency;
  onChange: (frequency: Frequency) => void;
  dark: boolean;
}) {
  return (
    <div
      className={cn(
        "pricing-frequency-toggle relative mx-auto grid w-fit grid-cols-2 rounded-full border p-1",
        dark ? "border-white/15 bg-white/[0.06]" : "border-black/10 bg-black/[0.035]",
      )}
      role="radiogroup"
      aria-label="Billing frequency"
    >
      <span
        className={cn(
          "pricing-frequency-thumb absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full",
          dark ? "bg-white" : "bg-neutral-950",
          frequency === "yearly" && "translate-x-full",
        )}
        aria-hidden="true"
      />
      {frequencies.map((freq) => (
        <button
          key={freq}
          type="button"
          role="radio"
          aria-checked={frequency === freq}
          onClick={() => onChange(freq)}
          className={cn(
            "relative z-10 h-9 min-w-[6rem] rounded-full px-5 text-sm font-semibold capitalize transition-colors",
            frequency === freq
              ? dark
                ? "text-neutral-950"
                : "text-white"
              : dark
                ? "text-white/72 hover:text-white"
                : "text-neutral-600 hover:text-neutral-950",
          )}
        >
          {freq}
        </button>
      ))}
    </div>
  );
}

function PricingCard({
  plan,
  frequency,
  currency,
  dark,
  showHighlightEffect,
}: {
  plan: PricingPlan;
  frequency: Frequency;
  currency: string;
  dark: boolean;
  showHighlightEffect: boolean;
}) {
  const highlighted = plan.highlighted;
  const price = displayPrice(plan, frequency, currency);
  const hasCustomPrice = Boolean(plan.priceLabel.trim());
  const off = frequency === "yearly" ? discountFor(plan) : 0;
  const ctaHref = plan.ctaHref.trim() || "#";
  const ctaLabel = plan.ctaLabel.trim() || "Get started";

  return (
    <article
      className={cn(
        "pricing-card relative flex min-h-[30rem] w-full flex-col overflow-hidden rounded-lg border text-left sm:min-h-[35rem]",
        dark
          ? "border-white/12 bg-[#080808] text-white"
          : "border-black/10 bg-white text-neutral-950 shadow-sm",
        highlighted && (dark ? "bg-[#111111]" : "bg-neutral-50"),
      )}
    >
      {highlighted && showHighlightEffect && <span className="pricing-border-trail" />}

      <div
        className={cn(
          "relative min-h-[9.4rem] border-b p-5",
          dark
            ? highlighted
              ? "border-white/12 bg-white/[0.055]"
              : "border-white/10 bg-white/[0.025]"
            : highlighted
              ? "border-black/10 bg-black/[0.045]"
              : "border-black/10 bg-black/[0.02]",
        )}
      >
        <div className="absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-2">
          {highlighted && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold",
                dark
                  ? "border-white/12 bg-black text-white"
                  : "border-black/10 bg-white text-neutral-950",
              )}
            >
              <StarIcon className="h-3 w-3 fill-current" />
              Popular
            </span>
          )}
          {off > 0 && (
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold",
                dark
                  ? "border-white/12 bg-white text-black"
                  : "border-black/10 bg-neutral-950 text-white",
              )}
            >
              {off}% off
            </span>
          )}
        </div>

        <h3 className="pr-28 text-xl font-semibold tracking-tight">{plan.name}</h3>
        {plan.info && (
          <p
            className={cn(
              "mt-2 text-sm",
              dark ? "text-white/55" : "text-neutral-500",
            )}
          >
            {plan.info}
          </p>
        )}
        <p className="mt-4 flex items-end gap-1">
          <span className="text-4xl font-bold tracking-tight">
            {price}
          </span>
          {!hasCustomPrice && plan.name.toLowerCase() !== "free" && (
            <span
              className={cn(
                "pb-1 text-base",
                dark ? "text-white/56" : "text-neutral-500",
              )}
            >
              /{frequency === "monthly" ? "month" : "year"}
            </span>
          )}
        </p>
      </div>

      <div
        className={cn(
          "flex-1 space-y-4 px-5 py-7 text-sm",
          dark ? "text-white/58" : "text-neutral-600",
        )}
      >
        {plan.features.map((feature) => {
          const tooltip = feature.tooltip.trim();
          const included = feature.included !== false;
          const FeatureIcon = included ? CheckCircleIcon : X;
          return (
            <div key={feature.id} className="group/feature flex items-start gap-3">
              <FeatureIcon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  included
                    ? dark
                      ? "text-white"
                      : "text-neutral-950"
                    : dark
                      ? "text-white/28"
                      : "text-neutral-400",
                )}
                aria-hidden="true"
              />
              <div className="relative min-w-0">
                <span
                  className={cn(
                    tooltip && "border-b border-dashed",
                    dark
                      ? tooltip
                        ? "border-white/24"
                        : ""
                      : tooltip
                        ? "border-black/20"
                        : "",
                  )}
                >
                  {feature.text}
                </span>
                {tooltip && (
                  <span
                    className={cn(
                      "ml-2 inline-flex align-middle",
                      dark ? "text-white/38" : "text-neutral-400",
                    )}
                    title={tooltip}
                    aria-label={tooltip}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </span>
                )}
                {tooltip && (
                  <span
                    className={cn(
                      "pointer-events-none absolute z-30 mt-7 hidden max-w-[14rem] rounded-md border px-3 py-2 text-xs leading-relaxed shadow-lg group-hover/feature:inline-block group-focus-within/feature:inline-block",
                      dark
                        ? "border-white/12 bg-neutral-950 text-white"
                        : "border-black/10 bg-white text-neutral-700",
                    )}
                  >
                    {tooltip}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-auto border-t p-4",
          dark
            ? highlighted
              ? "border-white/12 bg-white/[0.055]"
              : "border-white/10"
            : highlighted
              ? "border-black/10 bg-black/[0.04]"
              : "border-black/10",
        )}
      >
        <Link
          href={ctaHref}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center rounded-md border px-4 text-sm font-semibold transition",
            highlighted
              ? dark
                ? "border-white bg-white text-neutral-950 hover:bg-white/90"
                : "border-neutral-950 bg-neutral-950 text-white hover:bg-neutral-800"
              : dark
                ? "border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                : "border-black/10 bg-white text-neutral-950 hover:bg-neutral-100",
          )}
        >
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}

function GlassGradientPricingCard({
  plan,
  frequency,
  currency,
  dark,
  index,
}: {
  plan: PricingPlan;
  frequency: Frequency;
  currency: string;
  dark: boolean;
  index: number;
}) {
  const highlighted = plan.highlighted;
  const price = displayPrice(plan, frequency, currency);
  const hasCustomPrice = Boolean(plan.priceLabel.trim());
  const ctaHref = plan.ctaHref.trim() || "#";
  const ctaLabel = plan.ctaLabel.trim() || "Get started";

  return (
    <article
      className={cn(
        "pricing-glass-card group relative flex min-h-[31.5rem] w-full flex-col overflow-hidden rounded-lg border px-6 py-7 text-center",
        "transition duration-300 hover:-translate-y-1",
        dark
          ? "border-white/12 bg-white/[0.06] text-white shadow-2xl shadow-black/35"
          : "border-neutral-200/90 bg-white/70 text-neutral-950 shadow-[0_24px_90px_rgba(15,23,42,0.08)]",
        highlighted &&
          (dark
            ? "border-white/22 bg-white/[0.095]"
            : "border-neutral-300 bg-white/85"),
      )}
      style={
        {
          "--pricing-glass-delay": `${index * 110}ms`,
        } as CSSPropertiesWithVars
      }
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-90 transition-opacity duration-300 group-hover:opacity-100",
          dark
            ? "bg-[radial-gradient(circle_at_50%_4%,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_50%_86%,rgba(59,130,246,0.16),transparent_42%)]"
            : "bg-[radial-gradient(circle_at_50%_0%,rgba(15,23,42,0.08),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(148,163,184,0.16),transparent_42%)]",
        )}
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col">
        <h3 className="text-base font-medium tracking-tight">{plan.name}</h3>

        <div className="mt-7">
          <p
            className={cn(
              "text-balance text-4xl font-semibold tracking-tight",
              hasCustomPrice ? "text-[2.35rem] leading-tight" : "",
            )}
          >
            {price}
            {!hasCustomPrice && (
              <span className="text-[0.72em] font-semibold">
                /{frequency === "monthly" ? "mo" : "yr"}
              </span>
            )}
          </p>
          {plan.info && (
            <p
              className={cn(
                "mt-4 text-base leading-relaxed",
                dark ? "text-white/70" : "text-neutral-700",
              )}
            >
              {plan.info}
            </p>
          )}
        </div>

        <div
          className={cn(
            "mt-7 border-t pt-7",
            dark ? "border-white/12" : "border-neutral-200",
          )}
        >
          <ul className="space-y-4 text-left text-sm">
            {plan.features.map((feature) => {
              const included = feature.included !== false;
              return (
                <li
                  key={feature.id}
                  className={cn(
                    "flex items-center gap-3",
                    included
                      ? dark
                        ? "text-white/78"
                        : "text-neutral-600"
                      : dark
                        ? "text-white/38"
                        : "text-neutral-500",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                      included
                        ? dark
                          ? "bg-white text-neutral-950"
                          : "bg-neutral-950 text-white"
                        : dark
                          ? "bg-white/10 text-white/55"
                          : "bg-neutral-100 text-neutral-500",
                    )}
                    aria-hidden="true"
                  >
                    {included ? (
                      <Check className="h-3 w-3 stroke-[3]" />
                    ) : (
                      <X className="h-3 w-3 stroke-[2.5]" />
                    )}
                  </span>
                  <span>{feature.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-auto pt-10">
          <Link
            href={ctaHref}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center rounded-md px-5 text-sm font-semibold transition",
              highlighted
                ? dark
                  ? "bg-white text-neutral-950 hover:bg-white/90"
                  : "bg-neutral-950 text-white hover:bg-neutral-800"
                : dark
                  ? "text-white hover:bg-white/[0.08]"
                  : "text-neutral-950 hover:bg-neutral-100",
            )}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}

function GlassGradientPricingBlock({
  block,
  plans,
  frequency,
  setFrequency,
  dark,
  title,
  description,
}: {
  block: PricingBlockData;
  plans: PricingPlan[];
  frequency: Frequency;
  setFrequency: (frequency: Frequency) => void;
  dark: boolean;
  title: string;
  description: string;
}) {
  const showToggle = block.showBillingToggle !== false;
  const gridClass =
    plans.length === 1
      ? "max-w-sm grid-cols-1"
      : plans.length === 2
        ? "max-w-3xl grid-cols-1 md:grid-cols-2"
        : "max-w-5xl grid-cols-1 md:grid-cols-3";

  return (
    <section
      className={cn(
        "pricing-block pricing-block--glass-gradient relative overflow-hidden py-20 sm:py-28",
        dark ? "bg-[#07080d] text-white" : "bg-white text-neutral-950",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          dark
            ? "bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.22),transparent_28%),radial-gradient(circle_at_10%_100%,rgba(14,165,233,0.12),transparent_30%)]"
            : "bg-[radial-gradient(circle_at_50%_4%,rgba(148,163,184,0.20),transparent_26%),radial-gradient(circle_at_100%_100%,rgba(226,232,240,0.55),transparent_34%)]",
        )}
        aria-hidden="true"
      />
      <Container className="relative z-10">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto mb-12 max-w-3xl space-y-4 text-center">
            <h2 className="text-balance text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
              {title}
            </h2>
            {description && (
              <p
                className={cn(
                  "text-balance text-base leading-relaxed md:text-lg",
                  dark ? "text-white/60" : "text-neutral-500",
                )}
              >
                {description}
              </p>
            )}
            {showToggle && (
              <div className="pt-4">
                <PricingFrequencyToggle
                  frequency={frequency}
                  onChange={setFrequency}
                  dark={dark}
                />
              </div>
            )}
          </div>

          <div className={cn("mx-auto grid gap-6", gridClass)}>
            {plans.map((plan, index) => (
              <GlassGradientPricingCard
                key={plan.id}
                plan={plan}
                frequency={frequency}
                currency={block.currency || "$"}
                dark={dark}
                index={index}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

export function PricingBlock({
  block,
  photoMap,
}: {
  block: PricingBlockData;
  photoMap?: PhotoMap;
}) {
  const plans = useMemo(() => filteredPlans(block.plans ?? []), [block.plans]);
  const [frequency, setFrequency] = useState<Frequency>(
    block.defaultFrequency ?? "monthly",
  );
  const theme = block.theme ?? "auto";
  const dark = usePricingDarkMode(theme);
  const title = block.heading.trim() || "Plans that Scale with You";
  const description = block.description.trim();
  const showToggle = block.showBillingToggle !== false;
  const gridClass =
    plans.length === 1
      ? "max-w-sm grid-cols-1"
      : plans.length === 2
        ? "max-w-3xl grid-cols-1 md:grid-cols-2"
        : "max-w-6xl grid-cols-1 md:grid-cols-3";

  useEffect(() => {
    if (!showToggle) setFrequency(block.defaultFrequency ?? "monthly");
  }, [block.defaultFrequency, showToggle]);

  if (plans.length === 0) {
    return (
      <Container className="py-14 sm:py-20">
        <div className="mx-auto flex min-h-64 max-w-5xl items-center justify-center rounded-lg border border-dashed text-sm text-[hsl(var(--muted-foreground))]">
          Price - add a plan
        </div>
      </Container>
    );
  }

  if ((block.style ?? "standard") === "glass-gradient") {
    return (
      <GlassGradientPricingBlock
        block={block}
        plans={plans}
        frequency={frequency}
        setFrequency={setFrequency}
        dark={dark}
        title={title}
        description={description}
      />
    );
  }

  if ((block.style ?? "standard") === "tora-price-list-style-1") {
    return (
      <ToraPriceListStyle1Block
        block={block}
        plans={plans}
        frequency={frequency}
        dark={dark}
        photoMap={photoMap}
      />
    );
  }

  if ((block.style ?? "standard") === "tora-price-list-style-3") {
    return (
      <ToraPriceListStyle3Block
        block={block}
        plans={plans}
        frequency={frequency}
        dark={dark}
        photoMap={photoMap}
      />
    );
  }

  if ((block.style ?? "standard") === "tora-casting-services") {
    return (
      <ToraCastingServicesBlock
        block={block}
        plans={plans}
        dark={dark}
        photoMap={photoMap}
      />
    );
  }

  if ((block.style ?? "standard") === "tora-pricing-slider") {
    return (
      <ToraPricingSliderBlock
        block={block}
        plans={plans}
        frequency={frequency}
        dark={dark}
        photoMap={photoMap}
      />
    );
  }

  if (isToraPricingStyle(block.style)) {
    return (
      <ToraPricingBlock
        block={block}
        plans={plans}
        frequency={frequency}
        dark={dark}
        photoMap={photoMap}
      />
    );
  }

  return (
    <section
      className={cn(
        "pricing-block py-16 sm:py-24",
        dark ? "bg-black text-white" : "bg-white text-neutral-950",
      )}
    >
      <Container>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center space-y-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {title}
            </h2>
            {description && (
              <p
                className={cn(
                  "mx-auto max-w-xl text-balance text-sm leading-relaxed sm:text-base",
                  dark ? "text-white/55" : "text-neutral-500",
                )}
              >
                {description}
              </p>
            )}
          </div>

          {showToggle && (
            <PricingFrequencyToggle
              frequency={frequency}
              onChange={setFrequency}
              dark={dark}
            />
          )}

          <div className={cn("grid w-full gap-5", gridClass)}>
            {plans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                frequency={frequency}
                currency={block.currency || "$"}
                dark={dark}
                showHighlightEffect={block.showHighlightEffect !== false}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
