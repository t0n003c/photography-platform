import { requireRole } from "@/src/auth/session";
import { ok, problem } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { siteSettings } from "@/src/db/schema";
import { getStorage } from "@/src/storage";
import {
  SITE_SETTINGS_ID,
  invalidateSiteSettings,
} from "@/src/db/queries/settings";

export const dynamic = "force-dynamic";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};
const MAX_BYTES = 1024 * 1024; // 1 MB

// POST multipart/form-data { file } — store the site icon and record its key.
export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return problem(400, "INVALID_FORM", "Expected multipart form data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return problem(422, "NO_FILE", "No file provided.");
  }
  const ext = EXT[file.type];
  if (!ext) {
    return problem(422, "BAD_TYPE", "Icon must be PNG, JPEG, WebP, SVG or ICO.");
  }
  if (file.size > MAX_BYTES) {
    return problem(422, "TOO_LARGE", "Icon must be 1 MB or smaller.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const key = `site/icon.${ext}`;
  await getStorage().put(key, bytes, { contentType: file.type });

  await db
    .insert(siteSettings)
    .values({ id: SITE_SETTINGS_ID, iconStorageKey: key })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: { iconStorageKey: key },
    });
  await invalidateSiteSettings();

  await writeAudit({
    actorId: a.session.user.id,
    action: "settings.icon.update",
    entityType: "site_settings",
    entityId: SITE_SETTINGS_ID,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { key },
  });

  return ok({ iconStorageKey: key });
}
