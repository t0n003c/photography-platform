"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";

type Scope =
  | "home"
  | "gallery"
  | "category"
  | "location"
  | "about"
  | "global";

const SCOPES: Scope[] = [
  "home",
  "gallery",
  "category",
  "location",
  "about",
  "global",
];

type GridType = "masonry" | "justified" | "uniform";
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

function ConfigEditor({
  config,
  onUpdated,
}: {
  config: PageConfig;
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

  return (
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
          </Select>
        </Field>
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
}

export default function DesignPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<PageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingScope, setCreatingScope] = useState<Scope | null>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Design</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          These configs control how the public site renders each surface.
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
            return (
              <Card key={scope}>
                <CardHeader className="flex items-center justify-between gap-2">
                  <CardTitle>{SCOPE_LABEL[scope]}</CardTitle>
                  {matching.length === 0 && (
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
                  )}
                </CardHeader>
                <CardContent>
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
                          onUpdated={updateConfig}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
