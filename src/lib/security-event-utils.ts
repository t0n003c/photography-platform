export interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
  device: string | null;
}

function cleanHost(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function parseUserAgent(value?: string | null): ParsedUserAgent {
  const ua = value ?? "";
  if (!ua) return { browser: null, os: null, device: null };

  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Microsoft Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet";
  else if (/CriOS\//.test(ua)) browser = "Chrome iOS";
  else if (/FxiOS\//.test(ua)) browser = "Firefox iOS";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let os = "Unknown";
  if (/(iPhone|iPad|iPod)/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  let device = "Desktop";
  if (/(iPad|Tablet)/i.test(ua)) device = "Tablet";
  else if (/(Mobi|iPhone|Android)/i.test(ua)) device = "Mobile";

  return { browser, os, device };
}

export function trafficSourceFromReferrer(
  referrer?: string | null,
  currentHost?: string | null,
): string {
  if (!referrer) return "Direct";

  let host = "";
  try {
    host = cleanHost(new URL(referrer).hostname);
  } catch {
    return "Unknown";
  }

  const normalizedCurrentHost = currentHost ? cleanHost(currentHost) : "";
  if (normalizedCurrentHost && host === normalizedCurrentHost) return "Internal";

  if (hostMatches(host, "instagram.com")) return "Instagram";
  if (hostMatches(host, "facebook.com") || hostMatches(host, "fb.com")) {
    return "Facebook";
  }
  if (hostMatches(host, "google.com") || host.startsWith("google.")) {
    return "Google";
  }
  if (hostMatches(host, "bing.com")) return "Bing";
  if (
    hostMatches(host, "x.com") ||
    hostMatches(host, "twitter.com") ||
    hostMatches(host, "t.co")
  ) {
    return "X / Twitter";
  }
  if (hostMatches(host, "pinterest.com")) return "Pinterest";
  if (hostMatches(host, "youtube.com") || hostMatches(host, "youtu.be")) {
    return "YouTube";
  }
  if (hostMatches(host, "linkedin.com")) return "LinkedIn";

  return host;
}

export function normalizePathForSecurityEvent(value?: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      return `${url.pathname}${url.search}`.slice(0, 2048);
    }
  } catch {
    return null;
  }

  if (!raw.startsWith("/")) return null;
  return raw.slice(0, 2048);
}

export function normalizeEmailForSecurityEvent(value?: string | null): string | null {
  const email = value?.trim().toLowerCase();
  if (!email) return null;
  return email.slice(0, 254);
}
