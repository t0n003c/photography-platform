"use client";

import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { LiquidGlassSurface } from "@/components/effects/liquid-glass-surface";
import { cn } from "@/src/lib/utils";
import {
  DEFAULT_LOGIN_DESIGN,
  resolveLoginCardMaterial,
  type LoginDesignConfig,
} from "@/src/lib/login-design";

type CSSPropertiesWithVars = React.CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

function updateLoginHoverPosition(event: React.PointerEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;

  event.currentTarget.style.setProperty("--login-hover-x", `${x}%`);
  event.currentTarget.style.setProperty("--login-hover-y", `${y}%`);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function LoginShell({
  design = DEFAULT_LOGIN_DESIGN,
  siteName,
  description,
  children,
  preview = false,
  previewDevice,
  photoUrl,
  backgroundPhotoUrl,
}: {
  design?: LoginDesignConfig;
  siteName: string;
  description: string;
  children: React.ReactNode;
  preview?: boolean;
  previewDevice?: "desktop" | "mobile";
  photoUrl?: string | null;
  backgroundPhotoUrl?: string | null;
}) {
  const isReferenceLayout =
    design.layout === "gradient-card" || design.layout === "split-photo";
  const isSplit = design.layout === "split-photo";
  const cardMaterial = resolveLoginCardMaterial(design);
  const hasGlassMaterial =
    cardMaterial === "soft-glass" || cardMaterial === "liquid-glass";
  const useLiquidGlass = cardMaterial === "liquid-glass";
  const isReference = isReferenceLayout || hasGlassMaterial;
  const resolvedPhotoUrl = photoUrl || design.photoUrl.trim() || null;
  const resolvedBackgroundPhotoUrl =
    backgroundPhotoUrl || design.backgroundPhotoUrl.trim() || null;
  const useBackgroundPhoto =
    design.backgroundMode === "photo" && Boolean(resolvedBackgroundPhotoUrl);
  const photoWidth = clampNumber(design.photoWidth, 35, 70);
  const formWidth = 100 - photoWidth;
  const hoverIntensity = clampNumber(design.hoverGlowIntensity, 0, 70);
  const backgroundPhotoDim = clampNumber(design.backgroundPhotoDim, 0, 85);
  const backgroundPhotoBlur = clampNumber(design.backgroundPhotoBlur, 0, 24);
  const liquidGlassStrength = clampNumber(design.liquidGlassStrength, 40, 180);
  const liquidGlassChroma = clampNumber(design.liquidGlassChroma, 0, 14);
  const liquidGlassBlur = clampNumber(design.liquidGlassBlur, 0, 12);
  const liquidGlassSaturate = clampNumber(design.liquidGlassSaturate, 1, 2.2);
  const liquidGlassFallbackBlur = clampNumber(design.liquidGlassFallbackBlur, 8, 32);
  const liquidStrengthRatio = (liquidGlassStrength - 40) / 140;
  const liquidChromaRatio = liquidGlassChroma / 14;
  const liquidBlurRatio = liquidGlassBlur / 12;
  const liquidSaturateRatio = (liquidGlassSaturate - 1) / 1.2;
  const liquidFallbackRatio = (liquidGlassFallbackBlur - 8) / 24;
  const liquidSurfaceTopOpacity = 0.42 + liquidBlurRatio * 0.16;
  const liquidSurfaceFromOpacity = 0.28 + liquidSaturateRatio * 0.14;
  const liquidSurfaceToOpacity = 0.14 + liquidStrengthRatio * 0.12;
  const liquidDarkSurfaceTopOpacity = 0.1 + liquidBlurRatio * 0.08;
  const liquidDarkSurfaceFromOpacity = 0.42 + liquidSaturateRatio * 0.1;
  const liquidDarkSurfaceToOpacity = 0.5 + liquidStrengthRatio * 0.12;
  const liquidGlowOpacity = 0.22 + liquidStrengthRatio * 0.1;
  const liquidDarkGlowOpacity = 0.42 + liquidStrengthRatio * 0.16;
  const liquidInsetTopOpacity = 0.5 + liquidBlurRatio * 0.16;
  const liquidDarkInsetTopOpacity = 0.16 + liquidBlurRatio * 0.12;
  const liquidInsetOutlineOpacity = 0.12 + liquidChromaRatio * 0.14;
  const liquidDarkInsetOutlineOpacity = 0.06 + liquidChromaRatio * 0.1;
  const liquidPreviewOpacity = 0.18 + liquidStrengthRatio * 0.36;
  const liquidPreviewDarkOpacity = 0.24 + liquidStrengthRatio * 0.34;
  const liquidPreviewWhiteOpacity = 0.12 + liquidStrengthRatio * 0.18;
  const liquidPreviewSoftOpacity = 0.1 + liquidStrengthRatio * 0.16;
  const liquidPreviewBlurOpacity = 0.04 + liquidBlurRatio * 0.1;
  const liquidPreviewSheenOpacity = 0.03 + liquidStrengthRatio * 0.08;
  const background =
    design.backgroundMode === "custom"
      ? design.backgroundColor
      : design.backgroundMode === "soft-gradient"
        ? `linear-gradient(135deg, ${design.gradientFrom} 0%, ${design.gradientTo} 100%)`
        : undefined;
  const style = {
    "--login-bg": design.backgroundColor,
    "--login-from": design.gradientFrom,
    "--login-to": design.gradientTo,
    "--login-accent": design.cardAccent,
    "--login-hover": design.hoverColor,
    "--login-hover-intensity": `${hoverIntensity}%`,
    "--login-hover-size": `${clampNumber(design.hoverGlowSize, 24, 70)}%`,
    "--login-bg-photo-position": `${clampNumber(design.backgroundPhotoFocalX, 0, 100)}% ${clampNumber(design.backgroundPhotoFocalY, 0, 100)}%`,
    "--login-bg-photo-dim": (backgroundPhotoDim / 100).toFixed(3),
    "--login-bg-photo-blur": `${backgroundPhotoBlur}px`,
    "--login-bg-photo-scale": (1 + backgroundPhotoBlur / 180).toFixed(3),
    "--login-liquid-strength": liquidGlassStrength,
    "--login-liquid-chroma": liquidGlassChroma,
    "--login-liquid-blur": `${liquidGlassBlur}px`,
    "--login-liquid-saturate": liquidGlassSaturate,
    "--login-liquid-fallback-blur": `${liquidGlassFallbackBlur}px`,
    "--login-liquid-strength-alpha": liquidStrengthRatio.toFixed(3),
    "--login-liquid-strength-pct": `${Math.round(liquidStrengthRatio * 100)}%`,
    "--login-liquid-chroma-alpha": liquidChromaRatio.toFixed(3),
    "--login-liquid-chroma-pct": `${Math.round(liquidChromaRatio * 100)}%`,
    "--login-liquid-blur-alpha": liquidBlurRatio.toFixed(3),
    "--login-liquid-saturate-alpha": liquidSaturateRatio.toFixed(3),
    "--login-liquid-fallback-alpha": liquidFallbackRatio.toFixed(3),
    "--login-liquid-surface-top-opacity": liquidSurfaceTopOpacity.toFixed(3),
    "--login-liquid-surface-from-opacity": liquidSurfaceFromOpacity.toFixed(3),
    "--login-liquid-surface-to-opacity": liquidSurfaceToOpacity.toFixed(3),
    "--login-liquid-dark-surface-top-opacity": liquidDarkSurfaceTopOpacity.toFixed(3),
    "--login-liquid-dark-surface-from-opacity": liquidDarkSurfaceFromOpacity.toFixed(3),
    "--login-liquid-dark-surface-to-opacity": liquidDarkSurfaceToOpacity.toFixed(3),
    "--login-liquid-border-mix": `${Math.round(10 + liquidChromaRatio * 52)}%`,
    "--login-liquid-dark-border-mix": `${Math.round(8 + liquidChromaRatio * 42)}%`,
    "--login-liquid-glow-size": `${Math.round(58 + liquidStrengthRatio * 38)}px`,
    "--login-liquid-dark-glow-size": `${Math.round(70 + liquidStrengthRatio * 44)}px`,
    "--login-liquid-glow-opacity": liquidGlowOpacity.toFixed(3),
    "--login-liquid-dark-glow-opacity": liquidDarkGlowOpacity.toFixed(3),
    "--login-liquid-rim-width": `${(1 + liquidChromaRatio * 2).toFixed(2)}px`,
    "--login-liquid-rim-mix": `${Math.round(16 + liquidChromaRatio * 50)}%`,
    "--login-liquid-dark-rim-mix": `${Math.round(12 + liquidChromaRatio * 50)}%`,
    "--login-liquid-inset-top-opacity": liquidInsetTopOpacity.toFixed(3),
    "--login-liquid-dark-inset-top-opacity": liquidDarkInsetTopOpacity.toFixed(3),
    "--login-liquid-inset-blur": `${Math.round(18 + liquidFallbackRatio * 18)}px`,
    "--login-liquid-inset-outline-opacity": liquidInsetOutlineOpacity.toFixed(3),
    "--login-liquid-dark-inset-outline-opacity": liquidDarkInsetOutlineOpacity.toFixed(3),
    "--login-liquid-preview-opacity": liquidPreviewOpacity.toFixed(3),
    "--login-liquid-preview-dark-opacity": liquidPreviewDarkOpacity.toFixed(3),
    "--login-liquid-preview-shift": `${((liquidStrengthRatio - 0.5) * 8).toFixed(2)}px`,
    "--login-liquid-preview-blur": `${(liquidBlurRatio * 1.2).toFixed(2)}px`,
    "--login-liquid-preview-white-opacity": liquidPreviewWhiteOpacity.toFixed(3),
    "--login-liquid-preview-soft-opacity": liquidPreviewSoftOpacity.toFixed(3),
    "--login-liquid-preview-blur-opacity": liquidPreviewBlurOpacity.toFixed(3),
    "--login-liquid-preview-sheen-opacity": liquidPreviewSheenOpacity.toFixed(3),
    "--login-liquid-preview-accent-mix": `${Math.round(18 + liquidChromaRatio * 42)}%`,
    "--login-photo-columns":
      design.photoSide === "left"
        ? `${photoWidth}% ${formWidth}%`
        : `${formWidth}% ${photoWidth}%`,
    "--login-photo-position": `${clampNumber(design.photoFocalX, 0, 100)}% ${clampNumber(design.photoFocalY, 0, 100)}%`,
    background,
  } as CSSPropertiesWithVars;
  const cardClassName = cn(
    "login-card relative isolate overflow-hidden rounded-xl border bg-[hsl(var(--background))]",
    isReference ? "login-card--reference rounded-[1.75rem] shadow-inner" : "shadow-sm",
    cardMaterial === "solid" &&
      "login-card--solid border-[hsl(var(--border))] bg-[hsl(var(--background))] dark:bg-[hsl(var(--background))]",
    hasGlassMaterial &&
      "border-white/40 bg-white/92 dark:border-white/10 dark:bg-neutral-950/88",
    useLiquidGlass && "login-card--liquid-glass",
    isSplit && "login-card--split grid",
  );
  const cardContent = (
    <>
      {isReference && (
        <div className="login-card-hover-color pointer-events-none absolute inset-0 z-0" />
      )}
      {isSplit && (
        <div
          className={cn(
            "login-card-photo-panel relative z-10 min-h-[240px] overflow-hidden bg-[linear-gradient(135deg,var(--login-from),var(--login-to))] lg:min-h-[620px]",
            !design.showPhotoOnMobile && "hidden lg:block",
            !design.showPhotoOnMobile &&
              "login-card-photo-panel--mobile-hidden",
            design.photoSide === "right" && "lg:order-2",
          )}
        >
          {resolvedPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedPhotoUrl}
              alt={design.photoAlt || "Login photograph"}
              className="h-full w-full object-cover"
              style={{ objectPosition: "var(--login-photo-position)" }}
            />
          ) : (
            <div className="flex h-full min-h-[240px] items-center justify-center p-8 text-center text-white lg:min-h-[620px]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">
                  {siteName}
                </p>
                <p className="mt-4 text-3xl font-semibold leading-tight">
                  Secure studio access
                </p>
              </div>
            </div>
          )}
          <div className="from-black/34 to-black/16 absolute inset-0 bg-gradient-to-t via-black/0" />
        </div>
      )}
      <div
        className={cn(
          "relative z-10 flex min-w-0 flex-col",
          isSplit && "justify-center",
        )}
      >
        <div
          className={cn(
            "border-b p-5 text-center",
            hasGlassMaterial &&
              "border-white/50 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(255,255,255,0.56))] px-6 py-7 dark:border-white/10 dark:bg-[radial-gradient(circle_at_top,rgba(38,38,38,0.96),rgba(10,10,10,0.58))]",
            isReferenceLayout && !hasGlassMaterial && "px-6 py-7",
          )}
        >
          {design.showBrand && (
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.24em] text-[hsl(var(--muted-foreground))]",
                isReference && "text-[color:var(--login-accent)]",
              )}
            >
              {siteName}
            </p>
          )}
          <h1
            className={cn(
              "mt-2 text-xl font-semibold leading-tight",
              isReference && "text-3xl font-bold tracking-tight",
            )}
          >
            {design.headline}
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
          {design.showIconRow && (
            <div className="mt-5 flex justify-center gap-3">
              {[ShieldCheck, Fingerprint, KeyRound].map((Icon, index) => (
                <span
                  key={index}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] shadow-sm",
                    hasGlassMaterial &&
                      "border-white/50 bg-white/80 text-[color:var(--login-accent)] dark:border-white/10 dark:bg-white/10",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={cn("p-5", isReference && "p-6")}>{children}</div>
      </div>
    </>
  );

  return (
    <section
      className={cn(
        "login-shell relative isolate flex w-full items-center justify-center overflow-hidden px-4 py-12 text-[hsl(var(--foreground))]",
        preview ? "min-h-[560px] rounded-lg border" : "min-h-screen",
        preview && "login-shell--preview",
        preview && previewDevice === "mobile" && "login-shell--preview-mobile",
        preview && useLiquidGlass && "login-shell--liquid-preview",
        useBackgroundPhoto && "login-shell--photo-background",
        isReference
          ? "login-shell--reference bg-[hsl(var(--background))]"
          : "bg-[hsl(var(--background))]",
      )}
      style={style}
    >
      {useBackgroundPhoto && (
        <div className="login-shell-bg-photo" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedBackgroundPhotoUrl!}
            alt=""
            className="login-shell-bg-photo__image"
            style={{ objectPosition: "var(--login-bg-photo-position)" }}
          />
          <div className="login-shell-bg-photo__overlay" />
        </div>
      )}
      {isReference && !useBackgroundPhoto && (
        <>
          <div className="pointer-events-none absolute left-[8%] top-[12%] h-32 w-32 rounded-full bg-white/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[10%] right-[10%] h-40 w-40 rounded-full bg-black/15 blur-3xl" />
        </>
      )}
      <div
        className={cn(
          "relative z-10 w-full",
          isSplit ? "max-w-5xl" : "max-w-sm",
          isReference &&
            "bg-white/82 dark:bg-neutral-950/72 rounded-[2rem] border border-white/25 p-1 shadow-[0_28px_90px_rgb(15_23_42/0.28)] backdrop-blur-2xl dark:border-white/10",
        )}
      >
        {useLiquidGlass ? (
          <LiquidGlassSurface
            className={cardClassName}
            options={{
              scale: -liquidGlassStrength,
              chroma: liquidGlassChroma,
              blur: liquidGlassBlur,
              saturate: liquidGlassSaturate,
              fallbackBlur: liquidGlassFallbackBlur,
            }}
            refreshKey={`${design.layout}:${resolvedPhotoUrl ?? "none"}`}
            onPointerEnter={isReference ? updateLoginHoverPosition : undefined}
            onPointerMove={isReference ? updateLoginHoverPosition : undefined}
          >
            {cardContent}
          </LiquidGlassSurface>
        ) : (
          <div
            className={cardClassName}
            onPointerEnter={isReference ? updateLoginHoverPosition : undefined}
            onPointerMove={isReference ? updateLoginHoverPosition : undefined}
          >
            {cardContent}
          </div>
        )}
      </div>
    </section>
  );
}

export function loginControlClass(design: LoginDesignConfig) {
  const cardMaterial = resolveLoginCardMaterial(design);
  if (design.layout === "simple" && cardMaterial === "solid") return undefined;
  if (cardMaterial === "liquid-glass") {
    return "h-11 rounded-xl border-white/45 bg-white/62 shadow-inner backdrop-blur-sm transition focus:bg-white/82 dark:border-white/10 dark:bg-white/10 dark:focus:bg-white/16";
  }
  return "h-11 rounded-xl border-white/60 bg-white/72 shadow-inner transition focus:bg-white dark:border-white/10 dark:bg-white/10 dark:focus:bg-white/15";
}

export function loginPrimaryButtonClass(design: LoginDesignConfig) {
  const cardMaterial = resolveLoginCardMaterial(design);
  if (design.layout === "simple" && cardMaterial === "solid") return undefined;
  if (cardMaterial === "liquid-glass") {
    return "h-11 rounded-xl bg-white text-neutral-950 shadow-[0_14px_34px_rgb(15_23_42/0.2)] transition-transform hover:-translate-y-0.5 hover:bg-white/92 hover:opacity-100 active:translate-y-0 dark:bg-white dark:text-neutral-950 dark:hover:bg-white/90";
  }
  return "h-11 rounded-xl bg-[linear-gradient(135deg,var(--login-from),var(--login-to))] text-white shadow-[0_14px_30px_rgb(15_23_42/0.22)] transition-transform hover:-translate-y-0.5 hover:opacity-100 active:translate-y-0";
}

export function loginSecondaryButtonClass(design: LoginDesignConfig) {
  const cardMaterial = resolveLoginCardMaterial(design);
  if (design.layout === "simple" && cardMaterial === "solid") return undefined;
  if (cardMaterial === "liquid-glass") {
    return "h-11 rounded-xl border-white/45 bg-white/30 shadow-sm backdrop-blur hover:bg-white/46 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/16";
  }
  return "h-11 rounded-xl border-white/60 bg-white/60 shadow-sm backdrop-blur hover:bg-white/82 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15";
}
