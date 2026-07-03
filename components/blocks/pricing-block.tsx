"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { CheckCircleIcon, Info, StarIcon } from "lucide-react";
import { Container } from "@/components/ui/container";
import { cn } from "@/src/lib/utils";
import type { LeafBlock } from "@/src/lib/blocks";

type PricingBlockData = Extract<LeafBlock, { type: "pricing" }>;
type PricingPlan = PricingBlockData["plans"][number];
type Frequency = "monthly" | "yearly";

const frequencies: Frequency[] = ["monthly", "yearly"];

function formatPrice(value: number, currency: string) {
  if (!Number.isFinite(value)) return `${currency}0`;
  return `${currency}${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value)}`;
}

function discountFor(plan: PricingPlan) {
  const monthlyYear = plan.monthlyPrice * 12;
  if (!monthlyYear || plan.yearlyPrice >= monthlyYear) return 0;
  return Math.round(((monthlyYear - plan.yearlyPrice) / monthlyYear) * 100);
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
  const price = frequency === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
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
            {formatPrice(price, currency)}
          </span>
          {plan.name.toLowerCase() !== "free" && (
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
          return (
            <div key={feature.id} className="group/feature flex items-start gap-3">
              <CheckCircleIcon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  dark ? "text-white" : "text-neutral-950",
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

export function PricingBlock({ block }: { block: PricingBlockData }) {
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
