import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
  DEFAULT_LOGIN_DESIGN,
  type LoginDesignConfig,
} from "@/src/lib/login-design";

type CSSPropertiesWithVars = React.CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

export function LoginShell({
  design = DEFAULT_LOGIN_DESIGN,
  siteName,
  description,
  children,
  preview = false,
}: {
  design?: LoginDesignConfig;
  siteName: string;
  description: string;
  children: React.ReactNode;
  preview?: boolean;
}) {
  const isReference = design.layout === "gradient-card";
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
          "relative z-10 w-full max-w-sm",
          isReference &&
            "rounded-[2rem] border border-white/25 bg-white/82 p-1 shadow-[0_28px_90px_rgb(15_23_42/0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-950/72",
        )}
      >
        <div
          className={cn(
            "login-card overflow-hidden rounded-xl border bg-[hsl(var(--background))]",
            isReference
              ? "login-card--reference rounded-[1.75rem] border-white/40 bg-white/92 shadow-inner dark:border-white/10 dark:bg-neutral-950/88"
              : "shadow-sm",
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
    </section>
  );
}

export function loginControlClass(design: LoginDesignConfig) {
  if (design.layout !== "gradient-card") return undefined;
  return "h-11 rounded-xl border-white/60 bg-white/72 shadow-inner transition focus:bg-white dark:border-white/10 dark:bg-white/10 dark:focus:bg-white/15";
}

export function loginPrimaryButtonClass(design: LoginDesignConfig) {
  if (design.layout !== "gradient-card") return undefined;
  return "h-11 rounded-xl bg-[linear-gradient(135deg,var(--login-from),var(--login-to))] text-white shadow-[0_14px_30px_rgb(15_23_42/0.22)] transition-transform hover:-translate-y-0.5 hover:opacity-100 active:translate-y-0";
}

export function loginSecondaryButtonClass(design: LoginDesignConfig) {
  if (design.layout !== "gradient-card") return undefined;
  return "h-11 rounded-xl border-white/60 bg-white/60 shadow-sm backdrop-blur hover:bg-white/82 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15";
}
