import { LoginPageClient } from "@/components/auth/login-page-client";
import { getLoginConfig } from "@/src/db/queries/public";
import { getSiteSettings } from "@/src/db/queries/settings";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [settings, loginDesign] = await Promise.all([
    getSiteSettings(),
    getLoginConfig(),
  ]);
  const loginPhotoUrl =
    loginDesign.photoUrl.trim() ||
    (loginDesign.photoId ? "/api/v1/media/login-photo" : null);
  const loginBackgroundPhotoUrl =
    loginDesign.backgroundPhotoUrl.trim() ||
    (loginDesign.backgroundPhotoId
      ? "/api/v1/media/login-photo?slot=background"
      : null);

  return (
    <LoginPageClient
      siteName={settings.siteTitle}
      loginDesign={loginDesign}
      loginPhotoUrl={loginPhotoUrl}
      loginBackgroundPhotoUrl={loginBackgroundPhotoUrl}
    />
  );
}
