"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
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
type CSSPropertiesWithVars = CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

const frequencies: Frequency[] = ["monthly", "yearly"];
const DEFAULT_PRICING_TITLE = "Plans that Scale with You";
const DEFAULT_PRICING_DESCRIPTION =
  "Whether you're just starting out or growing fast, our flexible pricing has you covered - with no hidden costs.";
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
      setFallbackSystemDark(
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      );
    };
    sync();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);

    return () => {
      media.removeEventListener("change", sync);
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
