"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Globe2,
  type LucideIcon,
  LogIn,
  MailWarning,
  Network,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";
import { cn } from "@/src/lib/utils";

type Tone = "neutral" | "green" | "amber" | "red" | "blue";
type View = "overview" | "contact" | "login" | "traffic" | "ips";

interface SecuritySummary {
  contactTotal: number;
  contactSpam: number;
  loginTotal: number;
  loginFailed: number;
  loginBlocked: number;
  trafficTotal: number;
  uniqueIps: number;
  topSource: string;
  topIp: string;
}

interface ContactRow {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  spamScore: number | null;
  spamVerdict: "ham" | "spam" | "unknown";
  status: "new" | "read" | "replied" | "archived" | "spam";
  ipAddress: string | null;
  ipFrequency: number;
  country: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  spamSignals: unknown;
  createdAt: string;
}

interface SecurityEventRow {
  id: string;
  surface: "contact" | "login" | "traffic";
  action: string;
  outcome: "allowed" | "blocked" | "spam" | "failed" | "success" | "unknown";
  ipAddress: string | null;
  country: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  source: string | null;
  path: string | null;
  email: string | null;
  metadata: unknown;
  createdAt: string;
}

interface TrafficSourceRow {
  source: string;
  count: number;
  latestAt: string | null;
  latestPath: string | null;
  mobile: number;
  desktop: number;
  tablet: number;
}

interface IpRow {
  ipAddress: string;
  total: number;
  contact: number;
  login: number;
  traffic: number;
  country: string | null;
  latestAt: string | null;
}

interface SecurityResponse {
  generatedAt: string;
  summary: SecuritySummary;
  contacts: ContactRow[];
  loginEvents: SecurityEventRow[];
  trafficSources: TrafficSourceRow[];
  recentTraffic: SecurityEventRow[];
  topIps: IpRow[];
  recentEvents: SecurityEventRow[];
}

const TABS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "contact", label: "Contact" },
  { id: "login", label: "Login" },
  { id: "traffic", label: "Traffic" },
  { id: "ips", label: "IPs" },
];

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function dash(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function verdictTone(value: ContactRow["spamVerdict"]): Tone {
  if (value === "spam") return "red";
  if (value === "ham") return "green";
  return "neutral";
}

function outcomeTone(value: SecurityEventRow["outcome"]): Tone {
  if (value === "success" || value === "allowed") return "green";
  if (value === "blocked" || value === "failed" || value === "spam") return "red";
  return "neutral";
}

function prettyAction(value: string): string {
  return value.replace(/[._-]+/g, " ");
}

function deviceText(row: {
  browser?: string | null;
  os?: string | null;
  device?: string | null;
}): string {
  return [row.device, row.browser, row.os].filter(Boolean).join(" / ") || "-";
}

function spamSignalLabels(value: unknown): string[] {
  if (!isRecord(value)) return [];
  const labels: string[] = [];
  if (value.honeypot) labels.push("honeypot");
  if (value.tooFast) labels.push("too fast");
  if (value.captchaFailed) labels.push("captcha");
  if (value.tooManyLinks) labels.push("links");
  if (value.emailDomainBlocked) labels.push("domain");
  if (Array.isArray(value.keywordMatches) && value.keywordMatches.length > 0) {
    labels.push("keywords");
  }
  return labels;
}

function metadataText(value: unknown): string {
  if (!isRecord(value)) return "-";
  const parts: string[] = [];
  for (const key of ["reason", "window", "status", "spamVerdict"]) {
    const item = value[key];
    if (typeof item === "string" || typeof item === "number") {
      parts.push(`${key}: ${item}`);
    }
  }
  return parts.length ? parts.join(" / ") : "-";
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{detail}</p>
        </div>
        <div className="rounded-md bg-[hsl(var(--muted))] p-2">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className="min-w-20"
    >
      {children}
    </Button>
  );
}

function ContactTable({ rows }: { rows: ContactRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No contact activity" />;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Spam</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="min-w-[980px] text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Sender</th>
              <th className="px-4 py-3 font-medium">Verdict</th>
              <th className="px-4 py-3 font-medium">IP</th>
              <th className="px-4 py-3 font-medium">Country</th>
              <th className="px-4 py-3 font-medium">Device</th>
              <th className="px-4 py-3 font-medium">Signals</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 align-top">{formatDate(row.createdAt)}</td>
                <td className="max-w-60 px-4 py-3 align-top">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {row.email}
                  </p>
                  {row.subject && (
                    <p className="mt-1 truncate text-xs">{row.subject}</p>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={verdictTone(row.spamVerdict)}>{row.spamVerdict}</Badge>
                    <Badge tone="neutral">{row.status}</Badge>
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <p>{dash(row.ipAddress)}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {row.ipFrequency} contact{row.ipFrequency === 1 ? "" : "s"}
                  </p>
                </td>
                <td className="px-4 py-3 align-top">{dash(row.country)}</td>
                <td className="px-4 py-3 align-top">{deviceText(row)}</td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap gap-1">
                    {spamSignalLabels(row.spamSignals).length ? (
                      spamSignalLabels(row.spamSignals).map((label) => (
                        <Badge key={label} tone="amber">
                          {label}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[hsl(var(--muted-foreground))]">-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function EventTable({
  title,
  rows,
  showSource = false,
}: {
  title: string;
  rows: SecurityEventRow[];
  showSource?: boolean;
}) {
  if (rows.length === 0) return <EmptyState title={`No ${title.toLowerCase()}`} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="min-w-[900px] text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Outcome</th>
              <th className="px-4 py-3 font-medium">
                {showSource ? "Source" : "Email"}
              </th>
              <th className="px-4 py-3 font-medium">IP</th>
              <th className="px-4 py-3 font-medium">Country</th>
              <th className="px-4 py-3 font-medium">Device</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 align-top">{formatDate(row.createdAt)}</td>
                <td className="px-4 py-3 align-top capitalize">
                  {prettyAction(row.action)}
                </td>
                <td className="px-4 py-3 align-top">
                  <Badge tone={outcomeTone(row.outcome)}>{row.outcome}</Badge>
                </td>
                <td className="max-w-56 px-4 py-3 align-top">
                  <p className="truncate">
                    {showSource ? dash(row.source) : dash(row.email)}
                  </p>
                  {showSource && (
                    <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {dash(row.path)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 align-top">{dash(row.ipAddress)}</td>
                <td className="px-4 py-3 align-top">{dash(row.country)}</td>
                <td className="px-4 py-3 align-top">{deviceText(row)}</td>
                <td className="max-w-72 px-4 py-3 align-top text-xs text-[hsl(var(--muted-foreground))]">
                  {metadataText(row.metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function TrafficSourcesTable({ rows }: { rows: TrafficSourceRow[] }) {
  if (rows.length === 0) return <EmptyState title="No traffic sources" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic Sources</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="min-w-[720px] text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Visits</th>
              <th className="px-4 py-3 font-medium">Device Mix</th>
              <th className="px-4 py-3 font-medium">Latest Page</th>
              <th className="px-4 py-3 font-medium">Latest Visit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.source}>
                <td className="px-4 py-3 font-medium">{row.source}</td>
                <td className="px-4 py-3">{row.count}</td>
                <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
                  {row.mobile} mobile / {row.desktop} desktop / {row.tablet} tablet
                </td>
                <td className="max-w-80 truncate px-4 py-3">{dash(row.latestPath)}</td>
                <td className="px-4 py-3">{formatDate(row.latestAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function IpTable({ rows }: { rows: IpRow[] }) {
  if (rows.length === 0) return <EmptyState title="No IP activity" />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>IP Frequency</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="min-w-[760px] text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-4 py-3 font-medium">IP</th>
              <th className="px-4 py-3 font-medium">Country</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Login</th>
              <th className="px-4 py-3 font-medium">Traffic</th>
              <th className="px-4 py-3 font-medium">Latest</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.ipAddress}>
                <td className="px-4 py-3 font-medium">{row.ipAddress}</td>
                <td className="px-4 py-3">{dash(row.country)}</td>
                <td className="px-4 py-3">{row.total}</td>
                <td className="px-4 py-3">{row.contact}</td>
                <td className="px-4 py-3">{row.login}</td>
                <td className="px-4 py-3">{row.traffic}</td>
                <td className="px-4 py-3">{formatDate(row.latestAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default function SecurityPage() {
  const { toast } = useToast();
  const [data, setData] = useState<SecurityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("overview");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.get<SecurityResponse>("/api/v1/admin/security");
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) toast(errMsg(err), "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const stats = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "Contact Spam",
        value: data.summary.contactSpam,
        detail: `${data.summary.contactTotal} recent submissions`,
        icon: MailWarning,
      },
      {
        label: "Login Risk",
        value: data.summary.loginFailed,
        detail: `${data.summary.loginBlocked} blocked attempts`,
        icon: LogIn,
      },
      {
        label: "Traffic",
        value: data.summary.trafficTotal,
        detail: data.summary.topSource,
        icon: Globe2,
      },
      {
        label: "IP Activity",
        value: data.summary.uniqueIps,
        detail: data.summary.topIp,
        icon: Network,
      },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Security & Spam</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Contact spam, login attempts, traffic sources, and IP activity.
          </p>
        </div>
        {data && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Updated {formatDate(data.generatedAt)}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : !data ? (
        <EmptyState title="Security data unavailable" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((tab) => (
              <TabButton
                key={tab.id}
                active={view === tab.id}
                onClick={() => setView(tab.id)}
              >
                {tab.label}
              </TabButton>
            ))}
          </div>

          <div
            className={cn(
              "grid gap-5",
              view === "overview" && "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
            )}
          >
            {view === "overview" && (
              <>
                <EventTable title="Recent Events" rows={data.recentEvents} />
                <IpTable rows={data.topIps.slice(0, 10)} />
              </>
            )}
            {view === "contact" && <ContactTable rows={data.contacts} />}
            {view === "login" && (
              <EventTable title="Login Attempts" rows={data.loginEvents} />
            )}
            {view === "traffic" && (
              <div className="space-y-5">
                <TrafficSourcesTable rows={data.trafficSources} />
                <EventTable
                  title="Recent Traffic"
                  rows={data.recentTraffic}
                  showSource
                />
              </div>
            )}
            {view === "ips" && <IpTable rows={data.topIps} />}
          </div>

          <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <Activity className="h-3.5 w-3.5" />
            <span>{data.recentEvents.length} recent security events loaded</span>
          </div>
        </>
      )}
    </div>
  );
}
