import { describe, expect, it } from "vitest";
import {
  countLinks,
  ipMatchesRule,
  isBlockedEmailDomain,
  matchingKeywords,
  normalizeSecurityConfig,
} from "@/src/lib/security-settings";

describe("security settings", () => {
  it("normalizes defaults and clamps numeric limits", () => {
    expect(
      normalizeSecurityConfig({
        contactCaptchaEnabled: true,
        contactHourlyLimit: 0,
        contactDailyLimit: 9999,
        contactMinSubmitMs: -10,
        contactMaxLinks: 200,
        blockedCountries: ["us", " United States ", "vn"],
        blockedEmailDomains: ["@Example.com", "example.com"],
      }),
    ).toMatchObject({
      contactCaptchaEnabled: true,
      contactHourlyLimit: 1,
      contactDailyLimit: 500,
      contactMinSubmitMs: 0,
      contactMaxLinks: 100,
      blockedCountries: ["US", "VN"],
      blockedEmailDomains: ["example.com"],
    });
  });

  it("matches exact IPs and IPv4 CIDR ranges", () => {
    expect(ipMatchesRule("203.0.113.10", "203.0.113.10")).toBe(true);
    expect(ipMatchesRule("203.0.113.10", "203.0.113.0/24")).toBe(true);
    expect(ipMatchesRule("203.0.114.10", "203.0.113.0/24")).toBe(false);
    expect(ipMatchesRule("2001:db8::1", "2001:db8::1")).toBe(true);
    expect(ipMatchesRule("2001:db8::1", "2001:db8::/32")).toBe(false);
  });

  it("matches blocked email domains including subdomains", () => {
    expect(isBlockedEmailDomain("person@example.com", ["example.com"])).toBe(true);
    expect(isBlockedEmailDomain("person@a.example.com", ["example.com"])).toBe(
      true,
    );
    expect(isBlockedEmailDomain("person@notexample.com", ["example.com"])).toBe(
      false,
    );
  });

  it("counts links and keyword matches", () => {
    expect(countLinks("visit https://example.com and www.example.org")).toBe(2);
    expect(matchingKeywords("Crypto package request", ["crypto", "casino"])).toEqual([
      "crypto",
    ]);
  });
});
