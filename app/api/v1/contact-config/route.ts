import { ok } from "@/src/lib/http";
import { captchaConfigured, turnstileSiteKey } from "@/src/lib/turnstile";
import { getSiteSettingsRow } from "@/src/db/queries/settings";
import { normalizeSecurityConfig } from "@/src/lib/security-settings";

export const dynamic = "force-dynamic";

// Public, no secrets: tells contact forms whether to render Turnstile.
export async function GET() {
  const row = await getSiteSettingsRow();
  const security = normalizeSecurityConfig(row?.securityConfig);
  const enabled = security.contactCaptchaEnabled && captchaConfigured();
  return ok(
    {
      captcha: {
        enabled,
        siteKey: enabled ? turnstileSiteKey() : null,
      },
    },
    { "Cache-Control": "no-store" },
  );
}
