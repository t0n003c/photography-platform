import { NextResponse } from "next/server";
import { getSiteSettingsRow } from "@/src/db/queries/settings";
import { captchaConfigured, turnstileSiteKey } from "@/src/lib/turnstile";

export const dynamic = "force-dynamic";

// Public (pre-auth): tells the login page whether to show the Turnstile widget
// and which site key to use. Never exposes the secret key.
export async function GET() {
  const row = await getSiteSettingsRow();
  const enabled = Boolean(row?.captchaEnabled) && captchaConfigured();
  return NextResponse.json({
    captcha: { enabled, siteKey: enabled ? turnstileSiteKey() : null },
  });
}
