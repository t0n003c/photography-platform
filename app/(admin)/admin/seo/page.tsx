"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";
import type {
  SeoAuditCheck,
  SeoAuditResponse,
  SeoAuditUrl,
  SeoCheckStatus,
  SeoSurfaceType,
} from "@/src/lib/seo-audit";
import { cn } from "@/src/lib/utils";

type Filter = "all" | "critical" | "warnings" | SeoSurfaceType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All URLs" },
  { value: "critical", label: "Critical" },
  { value: "warnings", label: "Warnings" },
  { value: "page", label: "Pages" },
  { value: "gallery", label: "Galleries" },
  { value: "category", label: "Categories" },
  { value: "location", label: "Locations" },
  { value: "product", label: "Products" },
  { value: "static", label: "Static" },
];

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

function statusTone(status: SeoCheckStatus) {
  if (status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "warn") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-red-200 bg-red-50 text-red-800";
}

function scoreTone(score: number) {
  if (score >= 85) return "text-emerald-700";
  if (score >= 60) return "text-amber-700";
  return "text-red-700";
}

function surfaceLabel(type: SeoSurfaceType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function failingChecks(checks: SeoAuditCheck[]) {
  return checks.filter((item) => item.status !== "pass");
}

function SummaryTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "red"
          ? "text-red-700"
          : tone === "blue"
            ? "text-sky-700"
            : "text-[hsl(var(--foreground))]";
  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          {label}
        </p>
        <p className={cn("text-3xl font-semibold", toneClass)}>{value}</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{detail}</p>
      </CardContent>
    </Card>
  );
}

function UrlRow({ row }: { row: SeoAuditUrl }) {
  const issues = failingChecks(row.checks);
  return (
    <div className="grid gap-4 border-b p-4 last:border-b-0 lg:grid-cols-[minmax(0,1.1fr)_110px_minmax(0,1.4fr)_120px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{surfaceLabel(row.type)}</Badge>
          {!row.sitemapListed && (
            <Badge className="border-red-200 bg-red-50 text-red-800">No sitemap</Badge>
          )}
        </div>
        <h3 className="mt-2 truncate text-sm font-semibold">{row.label}</h3>
        <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">
          {row.path}
        </p>
      </div>
      <div>
        <p className={cn("text-2xl font-semibold", scoreTone(row.score))}>
          {row.score}
        </p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">SEO score</p>
      </div>
      <div className="min-w-0 space-y-2">
        {issues.length === 0 ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            No content issues found
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {issues.slice(0, 4).map((issue) => (
              <span
                key={`${row.id}-${issue.key}`}
                title={issue.message}
                className={cn(
                  "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                  statusTone(issue.status),
                )}
              >
                {issue.status === "fail" && <AlertTriangle className="h-3 w-3" />}
                <span className="truncate">{issue.label}</span>
              </span>
            ))}
            {issues.length > 4 && (
              <span className="rounded-full border px-2.5 py-1 text-xs text-[hsl(var(--muted-foreground))]">
                +{issues.length - 4}
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {row.photoCount} image{row.photoCount === 1 ? "" : "s"} ·{" "}
          {row.missingAltCount} missing alt
        </p>
      </div>
      <div className="flex items-start gap-2 lg:justify-end">
        {row.editUrl && (
          <Link
            href={row.editUrl}
            className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium hover:bg-[hsl(var(--muted))]"
          >
            Edit
          </Link>
        )}
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium hover:bg-[hsl(var(--muted))]"
        >
          View
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

export default function SeoCenterPage() {
  const { toast } = useToast();
  const [data, setData] = useState<SeoAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get<SeoAuditResponse>("/api/v1/admin/seo");
      setData(res);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUrls = useMemo(() => {
    const rows = data?.urls ?? [];
    if (filter === "all") return rows;
    if (filter === "critical") return rows.filter((row) => row.score < 60);
    if (filter === "warnings") {
      return rows.filter((row) => row.score >= 60 && row.score < 85);
    }
    return rows.filter((row) => row.type === filter);
  }, [data?.urls, filter]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
        <Spinner />
        Loading SEO Center...
      </div>
    );
  }

  if (!data) {
    return <EmptyState title="SEO audit unavailable" />;
  }

  const { summary, imageAudit } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">SEO Center</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Technical and content checks for public search surfaces.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load(true)} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label="Average score"
          value={summary.averageScore}
          detail={`${summary.goodUrls} strong · ${summary.warningUrls} warnings · ${summary.failingUrls} critical`}
          tone={
            summary.averageScore >= 85
              ? "green"
              : summary.averageScore >= 60
                ? "amber"
                : "red"
          }
        />
        <SummaryTile
          label="Sitemap coverage"
          value={`${summary.sitemapListedUrls}/${summary.totalUrls}`}
          detail="Indexable URLs represented in sitemap.xml"
          tone={summary.sitemapListedUrls === summary.totalUrls ? "green" : "amber"}
        />
        <SummaryTile
          label="Image alt coverage"
          value={formatPercent(summary.imageAltCoverage)}
          detail={`${summary.publicPhotosMissingAlt} of ${summary.publicPhotos} public photos missing alt`}
          tone={
            summary.imageAltCoverage >= 90
              ? "green"
              : summary.imageAltCoverage >= 60
                ? "amber"
                : "red"
          }
        />
        <SummaryTile
          label="Public URLs"
          value={summary.totalUrls}
          detail="Pages, galleries, taxonomy, static routes, and products"
          tone="blue"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>URL Audit</CardTitle>
              <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                Lowest scores are listed first.
              </p>
            </div>
            <Select
              className="w-full sm:w-48"
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
            >
              {FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            {filteredUrls.length === 0 ? (
              <div className="p-6">
                <EmptyState title="No URLs match this filter" />
              </div>
            ) : (
              filteredUrls.map((row) => <UrlRow key={row.id} row={row} />)
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {data.recommendations.map((item) => (
                  <li key={item} className="flex gap-2 text-sm">
                    <Search className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Image SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-md border p-2">
                  <p className="font-semibold">{imageAudit.missingAlt}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">No alt</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="font-semibold">{imageAudit.missingCaption}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    No caption
                  </p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="font-semibold">{imageAudit.missingHeadline}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    No title
                  </p>
                </div>
              </div>

              {imageAudit.samples.length === 0 ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Public images have alt text.
                </div>
              ) : (
                <div className="space-y-2">
                  {imageAudit.samples.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.filename}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                          Used on {item.usageCount} public surface
                          {item.usageCount === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Link
                    href="/admin/library"
                    className="inline-flex text-sm font-medium text-sky-700 hover:underline"
                  >
                    Open library
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
