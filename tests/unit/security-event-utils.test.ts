import { describe, expect, it } from "vitest";
import {
  normalizeEmailForSecurityEvent,
  normalizePathForSecurityEvent,
  parseUserAgent,
  trafficSourceFromReferrer,
} from "@/src/lib/security-event-utils";

describe("security event helpers", () => {
  it("classifies common traffic sources", () => {
    expect(
      trafficSourceFromReferrer("https://l.instagram.com/?u=https%3A%2F%2Fsite"),
    ).toBe("Instagram");
    expect(
      trafficSourceFromReferrer("https://www.google.com/search?q=photography"),
    ).toBe("Google");
    expect(trafficSourceFromReferrer("https://example.com/a", "example.com")).toBe(
      "Internal",
    );
    expect(trafficSourceFromReferrer("")).toBe("Direct");
  });

  it("parses browser, os, and device from user agents", () => {
    const mobile = parseUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    expect(mobile).toEqual({
      browser: "Safari",
      os: "iOS",
      device: "Mobile",
    });

    const desktop = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    );
    expect(desktop).toEqual({
      browser: "Chrome",
      os: "Windows",
      device: "Desktop",
    });
  });

  it("normalizes stored path and email values", () => {
    expect(normalizePathForSecurityEvent("/portfolio?category=wedding")).toBe(
      "/portfolio?category=wedding",
    );
    expect(
      normalizePathForSecurityEvent("https://site.test/contact?from=instagram"),
    ).toBe("/contact?from=instagram");
    expect(normalizePathForSecurityEvent("not-a-path")).toBeNull();
    expect(normalizeEmailForSecurityEvent(" USER@Example.COM ")).toBe(
      "user@example.com",
    );
  });
});
