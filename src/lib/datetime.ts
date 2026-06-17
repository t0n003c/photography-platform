import { getSiteSettings } from "@/src/db/queries/settings";

// Date/time formatting that honors the site's configured locale, timezone and
// date style (Settings → General). Uses the platform Intl API — no extra date
// dependency. Server-side helpers resolve settings; the pure formatter can be
// used anywhere once you have the options.

export interface DateFormatOptions {
  locale: string;
  timezone: string;
  dateStyle: "short" | "medium" | "long" | "full";
}

export function formatDateWith(
  value: Date | string | number,
  opts: DateFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(opts.locale, {
    dateStyle: opts.dateStyle,
    timeZone: opts.timezone,
  }).format(date);
}

export function formatDateTimeWith(
  value: Date | string | number,
  opts: DateFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(opts.locale, {
    dateStyle: opts.dateStyle,
    timeStyle: "short",
    timeZone: opts.timezone,
  }).format(date);
}

/** Server-side: format a date using the live site settings. */
export async function formatDate(value: Date | string | number): Promise<string> {
  const s = await getSiteSettings();
  return formatDateWith(value, {
    locale: s.locale,
    timezone: s.timezone,
    dateStyle: s.dateFormat,
  });
}
