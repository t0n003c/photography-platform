import { LoginPageClient } from "@/components/auth/login-page-client";
import { getLoginConfig } from "@/src/db/queries/public";
import { getSiteSettings } from "@/src/db/queries/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [settings, loginDesign] = await Promise.all([
    getSiteSettings(),
    getLoginConfig(),
  ]);

  return (
    <LoginPageClient
      siteName={settings.siteTitle}
      loginDesign={loginDesign}
    />
  );
}
