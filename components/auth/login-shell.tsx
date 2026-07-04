import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
  DEFAULT_LOGIN_DESIGN,
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
  photoUrl,
}: {
  design?: LoginDesignConfig;
  siteName: string;
  description: string;
  children: React.ReactNode;
  preview?: boolean;
  photoUrl?: string | null;
}) {
  const isReference =
    design.layout === "gradient-card" || design.layout === "split-photo";
  const isSplit = design.layout === "split-photo";
  const resolvedPhotoUrl = photoUrl || design.photoUrl.trim() || null;
  const photoWidth = clampNumber(design.photoWidth, 35, 70);
  const formWidth = 100 - photoWidth;
  const hoverIntensity = clampNumber(design.hoverGlowIntensity, 0, 70);
  const background =
    design.backgroundMode === "custom"
      ? design.backgroundColor
      : design.backgroundMode === "soft-gradient" || isReference
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
    "--login-photo-columns":
      design.photoSide === "left"
        ? `${photoWidth}% ${formWidth}%`
        : `${formWidth}% ${photoWidth}%`,
    "--login-photo-position": `${clampNumber(design.photoFocalX, 0, 100)}% ${clampNumber(design.photoFocalY, 0, 100)}%`,
    background,
  } as CSSPropertiesWithVars;

  return (
    <section
      className={cn(
        "login-shell relative isolate flex w-full items-center justify-center overflow-hidden px-4 py-12 text-[hsl(var(--foreground))]",
        preview ? "min-h-[560px] rounded-lg border" : "min-h-screen",
        isReference ? "login-shell--reference" : "bg-[hsl(var(--background))]",
      )}
      style={style}
    >
      {isReference && (
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
            "rounded-[2rem] border border-white/25 bg-white/82 p-1 shadow-[0_28px_90px_rgb(15_23_42/0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/72",
        )}
      >
        <div
          className={cn(
            "login-card relative isolate overflow-hidden rounded-xl border bg-[hsl(var(--background))]",
            isReference
              ? "login-card--reference rounded-[1.75rem] border-white/40 bg-white/92 shadow-inner dark:border-white/10 dark:bg-neutral-950/88"
              : "shadow-sm",
            isSplit && "login-card--split grid",
          )}
          onPointerEnter={isReference ? updateLoginHoverPosition : undefined}
          onPointerMove={isReference ? updateLoginHoverPosition : undefined}
        >
          {isReference && (
            <div className="login-card-hover-color pointer-events-none absolute inset-0 z-0" />
          )}
          {isSplit && (
            <div
              className={cn(
                "relative z-10 min-h-[240px] overflow-hidden bg-[linear-gradient(135deg,var(--login-from),var(--login-to))] lg:min-h-[620px]",
                !design.showPhotoOnMobile && "hidden lg:block",
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/34 via-black/0 to-black/16" />
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
                isReference &&
                  "border-white/50 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.96),rgba(255,255,255,0.56))] px-6 py-7 dark:border-white/10 dark:bg-[radial-gradient(circle_at_top,rgba(38,38,38,0.96),rgba(10,10,10,0.58))]",
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
                        isReference &&
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
        </div>
      </div>
    </section>
  );
}

export function loginControlClass(design: LoginDesignConfig) {
  if (design.layout === "simple") return undefined;
  return "h-11 rounded-xl border-white/60 bg-white/72 shadow-inner transition focus:bg-white dark:border-white/10 dark:bg-white/10 dark:focus:bg-white/15";
}

export function loginPrimaryButtonClass(design: LoginDesignConfig) {
  if (design.layout === "simple") return undefined;
  return "h-11 rounded-xl bg-[linear-gradient(135deg,var(--login-from),var(--login-to))] text-white shadow-[0_14px_30px_rgb(15_23_42/0.22)] transition-transform hover:-translate-y-0.5 hover:opacity-100 active:translate-y-0";
}

export function loginSecondaryButtonClass(design: LoginDesignConfig) {
  if (design.layout === "simple") return undefined;
  return "h-11 rounded-xl border-white/60 bg-white/60 shadow-sm backdrop-blur hover:bg-white/82 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15";
}
