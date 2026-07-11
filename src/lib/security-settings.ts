import { z } from "zod";

export interface SecurityConfig {
  contactCaptchaEnabled: boolean;
  contactHourlyLimit: number;
  contactDailyLimit: number;
  contactMinSubmitMs: number;
  contactMaxLinks: number;
  blockedIps: string[];
  blockedCountries: string[];
  blockedEmailDomains: string[];
  blockedKeywords: string[];
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  contactCaptchaEnabled: false,
  contactHourlyLimit: 3,
  contactDailyLimit: 10,
  contactMinSubmitMs: 3000,
  contactMaxLinks: 8,
  blockedIps: [],
  blockedCountries: [],
  blockedEmailDomains: [],
  blockedKeywords: [],
};

export const SecurityConfigInputSchema = z
  .object({
    contactCaptchaEnabled: z.boolean().optional(),
    contactHourlyLimit: z.number().int().min(1).max(100).optional(),
    contactDailyLimit: z.number().int().min(1).max(500).optional(),
    contactMinSubmitMs: z.number().int().min(0).max(30_000).optional(),
    contactMaxLinks: z.number().int().min(0).max(100).optional(),
    blockedIps: z.array(z.string().max(100)).max(500).optional(),
    blockedCountries: z.array(z.string().max(12)).max(250).optional(),
    blockedEmailDomains: z.array(z.string().max(255)).max(500).optional(),
    blockedKeywords: z.array(z.string().max(200)).max(500).optional(),
  })
  .passthrough();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") return value.split(/[\n,]+/);
  return [];
}

function normalizeList(
  value: unknown,
  transform: (value: string) => string | null,
  maxItems = 500,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of stringArray(value)) {
    const item = transform(raw);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeIpRule(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCountry(value: string): string | null {
  const country = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return country.length === 2 ? country : null;
}

function normalizeEmailDomain(value: string): string | null {
  const domain = value.trim().toLowerCase().replace(/^@+/, "");
  return domain.length > 0 ? domain : null;
}

function normalizeKeyword(value: string): string | null {
  const keyword = value.trim();
  return keyword.length > 0 ? keyword : null;
}

export function normalizeSecurityConfig(value: unknown): SecurityConfig {
  const input = asRecord(value);
  return {
    contactCaptchaEnabled: booleanValue(
      input.contactCaptchaEnabled,
      DEFAULT_SECURITY_CONFIG.contactCaptchaEnabled,
    ),
    contactHourlyLimit: numberInRange(
      input.contactHourlyLimit,
      DEFAULT_SECURITY_CONFIG.contactHourlyLimit,
      1,
      100,
    ),
    contactDailyLimit: numberInRange(
      input.contactDailyLimit,
      DEFAULT_SECURITY_CONFIG.contactDailyLimit,
      1,
      500,
    ),
    contactMinSubmitMs: numberInRange(
      input.contactMinSubmitMs,
      DEFAULT_SECURITY_CONFIG.contactMinSubmitMs,
      0,
      30_000,
    ),
    contactMaxLinks: numberInRange(
      input.contactMaxLinks,
      DEFAULT_SECURITY_CONFIG.contactMaxLinks,
      0,
      100,
    ),
    blockedIps: normalizeList(input.blockedIps, normalizeIpRule),
    blockedCountries: normalizeList(input.blockedCountries, normalizeCountry, 250),
    blockedEmailDomains: normalizeList(
      input.blockedEmailDomains,
      normalizeEmailDomain,
    ),
    blockedKeywords: normalizeList(input.blockedKeywords, normalizeKeyword),
  };
}

function parseIpv4(value: string): number | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    out = (out << 8) + octet;
  }
  return out >>> 0;
}

export function ipMatchesRule(ip: string, rule: string): boolean {
  const normalizedIp = ip.trim().toLowerCase();
  const normalizedRule = rule.trim().toLowerCase();
  if (!normalizedIp || !normalizedRule) return false;

  const [range, prefixRaw] = normalizedRule.split("/");
  if (prefixRaw !== undefined) {
    const ipNum = parseIpv4(normalizedIp);
    const rangeNum = parseIpv4(range ?? "");
    const prefix = Number(prefixRaw);
    if (
      ipNum === null ||
      rangeNum === null ||
      !Number.isInteger(prefix) ||
      prefix < 0 ||
      prefix > 32
    ) {
      return false;
    }
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (ipNum & mask) === (rangeNum & mask);
  }

  return normalizedIp === normalizedRule;
}

export function isBlockedIp(ip: string, rules: string[]): boolean {
  return rules.some((rule) => ipMatchesRule(ip, rule));
}

export function isBlockedEmailDomain(email: string, domains: string[]): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  return domains.some((blocked) => {
    const normalized = blocked.trim().toLowerCase().replace(/^@+/, "");
    return domain === normalized || domain.endsWith(`.${normalized}`);
  });
}

export function countLinks(value: string): number {
  return (value.match(/(?:https?:\/\/|www\.)\S+/gi) ?? []).length;
}

export function matchingKeywords(value: string, keywords: string[]): string[] {
  const haystack = value.toLowerCase();
  return keywords.filter((keyword) =>
    haystack.includes(keyword.trim().toLowerCase()),
  );
}
