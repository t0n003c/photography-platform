"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, KeyRound, Loader2, Plus, Instagram, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { LivePreview } from "@/components/admin/live-preview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import {
  LoginShell,
  loginControlClass,
  loginPrimaryButtonClass,
  loginSecondaryButtonClass,
} from "@/components/auth/login-shell";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";
import {
  DEFAULT_LOGIN_DESIGN,
  normalizeLoginDesign,
  type LoginDesignConfig,
} from "@/src/lib/login-design";

type Scope =
  | "home"
  | "gallery"
  | "category"
  | "location"
  | "about"
  | "global";

// Gallery layout is now per-gallery (set in the Galleries editor), so it is
// intentionally omitted here.
const SCOPES: Scope[] = ["home", "category", "location", "about", "global"];

type GridType = "masonry" | "justified" | "uniform" | "carousel-3d-scroll" | "alternative-scroll";
type Spacing = "tight" | "normal" | "airy";
type Theme = "light" | "dark" | "auto";

interface HeroConfig {
  enabled?: boolean;
  headline?: string;
  [key: string]: unknown;
}

interface PageConfig {
  id: string;
  scope: string;
  gridType: GridType;
  spacing: Spacing;
  theme: Theme;
  hero: HeroConfig | null;
  config: Record<string, unknown> | null;
  isDefault: boolean;
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

const SCOPE_LABEL: Record<Scope, string> = {
  home: "Home",
  gallery: "Gallery",
  category: "Category",
  location: "Location",
  about: "About",
  global: "Global",
};

// A representative public URL to preview each surface. Slug-based scopes need a
// real sample; resolved at runtime from existing content (null when none yet).
function previewUrlFor(scope: Scope, sampleSlug: string | null): string | null {
  switch (scope) {
    case "home":
    case "global":
      return "/";
    case "about":
      return "/about";
    case "category":
      return sampleSlug ? `/categories/${sampleSlug}` : null;
    case "location":
      return sampleSlug ? `/locations/${sampleSlug}` : null;
    case "gallery":
      return sampleSlug ? `/galleries/${sampleSlug}` : null;
  }
}

function CollapsibleDesignCard({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="gap-0">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${
                open ? "" : "-rotate-90"
              }`}
              aria-hidden="true"
            />
            <CardTitle>{title}</CardTitle>
          </button>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}

function ConfigEditor({
  config,
  previewUrl,
  onUpdated,
}: {
  config: PageConfig;
  previewUrl: string | null;
  onUpdated: (next: PageConfig) => void;
}) {
  const { toast } = useToast();
  const [gridType, setGridType] = useState<GridType>(config.gridType);
  const [spacing, setSpacing] = useState<Spacing>(config.spacing);
  const [theme, setTheme] = useState<Theme>(config.theme);
  const [heroEnabled, setHeroEnabled] = useState<boolean>(
    config.hero?.enabled ?? false,
  );
  const [headline, setHeadline] = useState<string>(config.hero?.headline ?? "");
  const [saving, setSaving] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);

  const draft = useMemo(
    () => ({
      gridType,
      spacing,
      theme,
      hero: { ...(config.hero ?? {}), enabled: heroEnabled, headline },
    }),
    [gridType, spacing, theme, heroEnabled, headline, config.hero],
  );

  const save = async () => {
    setSaving(true);
    try {
      const hero: HeroConfig = {
        ...(config.hero ?? {}),
        enabled: heroEnabled,
        headline,
      };
      const res = await api.patch<{ data: PageConfig }>(
        `/api/v1/admin/page-configs/${config.id}`,
        { gridType, spacing, theme, hero },
      );
      onUpdated(res.data);
      toast("Saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async () => {
    setSettingDefault(true);
    try {
      const res = await api.post<{ data: PageConfig }>(
        `/api/v1/admin/page-configs/${config.id}/set-default`,
      );
      onUpdated(res.data ?? { ...config, isDefault: true });
      toast("Set as default", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSettingDefault(false);
    }
  };

  const form = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Grid type">
          <Select
            value={gridType}
            onChange={(e) => setGridType(e.target.value as GridType)}
          >
            <option value="masonry">Masonry</option>
            <option value="justified">Justified</option>
            <option value="uniform">Uniform</option>
            {(config.scope === "category" || config.scope === "location") && (
              <option value="carousel-3d-scroll">3D carousel (on scroll)</option>
            )}
            <option value="alternative-scroll">Alternative scroll</option>
          </Select>
        </Field>
        {/* The Alternative Scroll layout manages its own spacing. */}
        {gridType !== "alternative-scroll" && (
          <Field label="Spacing">
            <Select
              value={spacing}
              onChange={(e) => setSpacing(e.target.value as Spacing)}
            >
              <option value="tight">Tight</option>
              <option value="normal">Normal</option>
              <option value="airy">Airy</option>
            </Select>
          </Field>
        )}
        <Field label="Theme">
          <Select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={heroEnabled}
          onChange={(e) => setHeroEnabled(e.target.checked)}
        />
        Show hero section
      </label>

      <Field label="Hero headline">
        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="A bold introduction"
          disabled={!heroEnabled}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </Button>
        {config.isDefault ? (
          <Badge tone="green">Default</Badge>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={setDefault}
            disabled={settingDefault}
          >
            {settingDefault && <Loader2 className="h-4 w-4 animate-spin" />}
            Set as default
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {form}
      {previewUrl ? (
        <LivePreview baseUrl={previewUrl} draft={draft} />
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Add a published {config.scope} to see a live preview. Your changes
          still save normally.
        </div>
      )}
    </div>
  );
}

export default function DesignPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<PageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingScope, setCreatingScope] = useState<Scope | null>(null);
  // Representative slug per slug-based scope, for the preview iframe.
  const [samples, setSamples] = useState<{
    category: string | null;
    location: string | null;
    gallery: string | null;
  }>({ category: null, location: null, gallery: null });

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<{ data: PageConfig[] }>("/api/v1/admin/page-configs")
      .then((res) => {
        if (active) setConfigs(res.data);
      })
      .catch((err) => {
        if (active) toast(errMsg(err), "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  // Fetch one representative slug per slug-based scope for the preview iframe.
  useEffect(() => {
    let active = true;
    const firstSlug = (rows: { slug?: string }[] | undefined): string | null =>
      rows?.find((r) => r.slug)?.slug ?? null;
    Promise.all([
      api
        .get<{ data: { slug: string }[] }>("/api/v1/admin/categories")
        .catch(() => ({ data: [] })),
      api
        .get<{ data: { slug: string }[] }>("/api/v1/admin/locations")
        .catch(() => ({ data: [] })),
      api
        .get<{ data: { slug: string }[] }>("/api/v1/admin/galleries")
        .catch(() => ({ data: [] })),
    ]).then(([cats, locs, gals]) => {
      if (!active) return;
      setSamples({
        category: firstSlug(cats.data),
        location: firstSlug(locs.data),
        gallery: firstSlug(gals.data),
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const updateConfig = (next: PageConfig) => {
    setConfigs((prev) =>
      prev.map((c) => {
        if (c.id === next.id) return next;
        // Only one default per scope.
        if (next.isDefault && c.scope === next.scope)
          return { ...c, isDefault: false };
        return c;
      }),
    );
  };

  const createConfig = async (scope: Scope) => {
    setCreatingScope(scope);
    try {
      const res = await api.post<{ data: PageConfig }>(
        "/api/v1/admin/page-configs",
        {
          scope,
          gridType: "justified",
          spacing: "normal",
          theme: "auto",
          hero: { enabled: false },
          config: {},
        },
      );
      setConfigs((prev) => [...prev, res.data]);
      toast("Config created", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setCreatingScope(null);
    }
  };

  const sampleFor = (scope: Scope): string | null => {
    if (scope === "category") return samples.category;
    if (scope === "location") return samples.location;
    if (scope === "gallery") return samples.gallery;
    return null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Design</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          These configs control how the public site renders each surface. The
          live preview shows unsaved changes — visible only to you until you
          save.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-6">
          {SCOPES.map((scope) => {
            const matching = configs.filter((c) => c.scope === scope);
            const previewUrl = previewUrlFor(scope, sampleFor(scope));
            return (
              <Fragment key={scope}>
              <CollapsibleDesignCard
                title={SCOPE_LABEL[scope]}
                actions={
                  matching.length === 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createConfig(scope)}
                    disabled={creatingScope === scope}
                  >
                    {creatingScope === scope ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Create config
                  </Button>
                  ) : null
                }
              >
                  {matching.length === 0 ? (
                    <EmptyState
                      title="No config for this surface"
                      description="Create one to control its layout and theme."
                    />
                  ) : (
                    <div className="space-y-6">
                      {matching.map((config) => (
                        <ConfigEditor
                          key={config.id}
                          config={config}
                          previewUrl={previewUrl}
                          onUpdated={updateConfig}
                        />
                      ))}
                    </div>
                  )}
              </CollapsibleDesignCard>
              {scope === "about" && (
                <>
                  <FooterDesignCard />
                  <LoginDesignCard />
                </>
              )}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LoginDesignCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfgId, setCfgId] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [baseConfig, setBaseConfig] = useState<Record<string, unknown>>({});
  const [siteTitle, setSiteTitle] = useState("Your studio");
  const [s, setS] = useState<LoginDesignConfig>(DEFAULT_LOGIN_DESIGN);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ data: PageConfig[] }>("/api/v1/admin/page-configs?scope=global"),
      api
        .get<{ data: { siteTitle: string } }>("/api/v1/admin/settings")
        .catch(() => ({ data: { siteTitle: "Your studio" } })),
    ])
      .then(([cfgRes, setRes]) => {
        if (!active) return;
        setSiteTitle(setRes.data.siteTitle || "Your studio");
        const globals = cfgRes.data.filter((c) => c.scope === "global");
        const pick = globals.find((c) => c.isDefault) ?? globals[0] ?? null;
        if (!pick) return;
        setCfgId(pick.id);
        setIsDefault(pick.isDefault);
        const cfg = (pick.config ?? {}) as Record<string, unknown>;
        setBaseConfig(cfg);
        setS(normalizeLoginDesign(cfg.login));
      })
      .catch((err) => active && toast(errMsg(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [toast]);

  const save = async () => {
    setSaving(true);
    try {
      let id = cfgId;
      let base = baseConfig;
      if (!id) {
        const res = await api.post<{ data: PageConfig }>(
          "/api/v1/admin/page-configs",
          {
            scope: "global",
            gridType: "justified",
            spacing: "normal",
            theme: "auto",
            hero: { enabled: false },
            config: {},
          },
        );
        id = res.data.id;
        base = {};
        setCfgId(id);
      }
      const nextConfig = { ...base, login: s };
      await api.patch(`/api/v1/admin/page-configs/${id}`, {
        config: nextConfig,
      });
      setBaseConfig(nextConfig);
      if (!isDefault) {
        await api.post(`/api/v1/admin/page-configs/${id}/set-default`);
        setIsDefault(true);
      }
      toast("Login design saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsibleDesignCard title="Login">
      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Layout">
                <Select
                  value={s.layout}
                  onChange={(e) =>
                    setS({ ...s, layout: e.target.value as LoginDesignConfig["layout"] })
                  }
                >
                  <option value="simple">Simple card</option>
                  <option value="gradient-card">Gradient card</option>
                </Select>
              </Field>
              <Field label="Background">
                <Select
                  value={s.backgroundMode}
                  onChange={(e) =>
                    setS({
                      ...s,
                      backgroundMode: e.target.value as LoginDesignConfig["backgroundMode"],
                    })
                  }
                >
                  <option value="default">Theme background</option>
                  <option value="soft-gradient">Soft gradient</option>
                  <option value="custom">Custom color</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Headline">
                <Input
                  value={s.headline}
                  onChange={(e) => setS({ ...s, headline: e.target.value })}
                />
              </Field>
              <Field label="Subtitle">
                <Input
                  value={s.subtitle}
                  onChange={(e) => setS({ ...s, subtitle: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Primary button label">
                <Input
                  value={s.primaryLabel}
                  onChange={(e) => setS({ ...s, primaryLabel: e.target.value })}
                />
              </Field>
              <Field label="Passkey button label">
                <Input
                  value={s.passkeyLabel}
                  onChange={(e) => setS({ ...s, passkeyLabel: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Background color">
                <Input
                  type="color"
                  value={s.backgroundColor}
                  onChange={(e) => setS({ ...s, backgroundColor: e.target.value })}
                  disabled={s.backgroundMode !== "custom"}
                />
              </Field>
              <Field label="Gradient from">
                <Input
                  type="color"
                  value={s.gradientFrom}
                  onChange={(e) => setS({ ...s, gradientFrom: e.target.value })}
                  disabled={s.backgroundMode === "default" && s.layout !== "gradient-card"}
                />
              </Field>
              <Field label="Gradient to">
                <Input
                  type="color"
                  value={s.gradientTo}
                  onChange={(e) => setS({ ...s, gradientTo: e.target.value })}
                  disabled={s.backgroundMode === "default" && s.layout !== "gradient-card"}
                />
              </Field>
              <Field label="Accent">
                <Input
                  type="color"
                  value={s.cardAccent}
                  onChange={(e) => setS({ ...s, cardAccent: e.target.value })}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.showBrand}
                  onChange={(e) => setS({ ...s, showBrand: e.target.checked })}
                />
                Show site name
              </label>
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.showIconRow}
                  onChange={(e) => setS({ ...s, showIconRow: e.target.checked })}
                />
                Show auth icon row
              </label>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save login
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Live preview
            </p>
            <LoginDesignPreview s={s} siteTitle={siteTitle} />
          </div>
        </div>
      )}
    </CollapsibleDesignCard>
  );
}

function LoginDesignPreview({
  s,
  siteTitle,
}: {
  s: LoginDesignConfig;
  siteTitle: string;
}) {
  const inputClass = loginControlClass(s);
  const primaryButtonClass = loginPrimaryButtonClass(s);
  const secondaryButtonClass = loginSecondaryButtonClass(s);

  return (
    <LoginShell design={s} siteName={siteTitle} description={s.subtitle} preview>
      <div className="space-y-4">
        <Field label="Email">
          <Input value="owner@example.com" readOnly className={inputClass} />
        </Field>
        <Field label="Password">
          <Input value="••••••••" readOnly className={inputClass} />
        </Field>
        <Button type="button" className={`w-full ${primaryButtonClass ?? ""}`}>
          {s.primaryLabel || "Sign in"}
        </Button>
        <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
          <span className="h-px flex-1 bg-[hsl(var(--border))]" />
          or
          <span className="h-px flex-1 bg-[hsl(var(--border))]" />
        </div>
        <Button
          type="button"
          variant="outline"
          className={`w-full ${secondaryButtonClass ?? ""}`}
        >
          <KeyRound className="h-4 w-4" />
          {s.passkeyLabel || "Sign in with passkey"}
        </Button>
      </div>
    </LoginShell>
  );
}

type FooterLayout = "menu" | "logo-text" | "instagram" | "text";
interface FooterSettings {
  layout: FooterLayout;
  text: string;
  instagramLimit: number;
  showSocial: boolean;
}

// Footer composition lives in the global page_config's `config.footer` jsonb.
// The public footer reads the DEFAULT global config, so saving ensures this
// config is the default. Footer menu links stay in the Menus tab.
function FooterDesignCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfgId, setCfgId] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [baseConfig, setBaseConfig] = useState<Record<string, unknown>>({});
  const [siteTitle, setSiteTitle] = useState("Your studio");
  const [hasLogo, setHasLogo] = useState(false);
  const [s, setS] = useState<FooterSettings>({
    layout: "menu",
    text: "",
    instagramLimit: 6,
    showSocial: true,
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ data: PageConfig[] }>("/api/v1/admin/page-configs?scope=global"),
      api
        .get<{ data: { siteTitle: string; logoStorageKey: string | null } }>(
          "/api/v1/admin/settings",
        )
        .catch(() => ({ data: { siteTitle: "Your studio", logoStorageKey: null } })),
    ])
      .then(([cfgRes, setRes]) => {
        if (!active) return;
        setSiteTitle(setRes.data.siteTitle || "Your studio");
        setHasLogo(Boolean(setRes.data.logoStorageKey));
        const globals = cfgRes.data.filter((c) => c.scope === "global");
        const pick = globals.find((c) => c.isDefault) ?? globals[0] ?? null;
        if (!pick) return;
        setCfgId(pick.id);
        setIsDefault(pick.isDefault);
        const cfg = (pick.config ?? {}) as Record<string, unknown>;
        setBaseConfig(cfg);
        const f = (cfg.footer ?? {}) as Partial<FooterSettings>;
        setS({
          layout: f.layout ?? "menu",
          text: f.text ?? "",
          instagramLimit:
            typeof f.instagramLimit === "number" ? f.instagramLimit : 6,
          showSocial: f.showSocial ?? true,
        });
      })
      .catch((err) => active && toast(errMsg(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [toast]);

  const save = async () => {
    setSaving(true);
    try {
      let id = cfgId;
      let base = baseConfig;
      if (!id) {
        const res = await api.post<{ data: PageConfig }>(
          "/api/v1/admin/page-configs",
          { scope: "global", gridType: "justified", spacing: "normal", theme: "auto", hero: { enabled: false }, config: {} },
        );
        id = res.data.id;
        base = {};
        setCfgId(id);
      }
      await api.patch(`/api/v1/admin/page-configs/${id}`, {
        config: { ...base, footer: s },
      });
      setBaseConfig({ ...base, footer: s });
      if (!isDefault) {
        await api.post(`/api/v1/admin/page-configs/${id}/set-default`);
        setIsDefault(true);
      }
      toast("Footer saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsibleDesignCard title="Footer">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <Field label="Layout">
                <Select
                  value={s.layout}
                  onChange={(e) => setS({ ...s, layout: e.target.value as FooterLayout })}
                >
                  <option value="menu">Menu links</option>
                  <option value="logo-text">Logo + text</option>
                  <option value="instagram">Instagram feed</option>
                  <option value="text">Plain text</option>
                </Select>
              </Field>
              {s.layout === "instagram" && (
                <Field label="Instagram photos">
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={s.instagramLimit}
                    onChange={(e) =>
                      setS({ ...s, instagramLimit: Number(e.target.value) || 6 })
                    }
                  />
                </Field>
              )}
              {(s.layout === "logo-text" || s.layout === "text") && (
                <Field label={s.layout === "logo-text" ? "Tagline / text" : "Text"}>
                  <Textarea
                    rows={3}
                    value={s.text}
                    onChange={(e) => setS({ ...s, text: e.target.value })}
                    placeholder="A line about the studio…"
                  />
                </Field>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.showSocial}
                  onChange={(e) => setS({ ...s, showSocial: e.target.checked })}
                />
                Show social icons
              </label>
              <div className="flex items-center gap-3 pt-1">
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save footer
                </Button>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Footer menu links are edited in the Menus tab.
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Live preview
              </p>
              <FooterPreview s={s} siteTitle={siteTitle} hasLogo={hasLogo} />
            </div>
          </div>
        )}
    </CollapsibleDesignCard>
  );
}

// Inline, instantly-updating mock of the public footer for the Design card.
function FooterPreview({
  s,
  siteTitle,
  hasLogo,
}: {
  s: FooterSettings;
  siteTitle: string;
  hasLogo: boolean;
}) {
  const year = new Date().getFullYear();
  const social = s.showSocial ? (
    <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))]">
      <Instagram className="h-4 w-4" aria-hidden="true" />
      <Mail className="h-4 w-4" aria-hidden="true" />
    </div>
  ) : null;
  const copyright = (
    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
      © {year} {siteTitle}. All rights reserved.
    </p>
  );

  let body: React.ReactNode;
  if (s.layout === "menu") {
    body = (
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold">{siteTitle}</p>
          {copyright}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-[hsl(var(--muted-foreground))]">
          <span>Portfolio</span>
          <span>About</span>
          <span>Contact</span>
        </div>
        {social}
      </div>
    );
  } else if (s.layout === "logo-text") {
    body = (
      <div className="flex flex-col items-center gap-2 text-center">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/api/v1/media/site-logo" alt={siteTitle} className="h-7 w-auto" />
        ) : (
          <p className="text-sm font-semibold">{siteTitle}</p>
        )}
        {s.text && (
          <p className="max-w-xs text-xs text-[hsl(var(--muted-foreground))]">{s.text}</p>
        )}
        {social}
        {copyright}
      </div>
    );
  } else if (s.layout === "instagram") {
    body = (
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: Math.max(1, Math.min(12, s.instagramLimit || 6)) }).map(
            (_, i) => (
              <div key={i} className="h-10 w-10 rounded-sm bg-[hsl(var(--muted))]" />
            ),
          )}
        </div>
        {social}
        {copyright}
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="max-w-md text-xs text-[hsl(var(--muted-foreground))]">
          {s.text || "Your footer text…"}
        </p>
        {social}
        {copyright}
      </div>
    );
  }

  return <div className="rounded-md border bg-[hsl(var(--background))] p-4">{body}</div>;
}
