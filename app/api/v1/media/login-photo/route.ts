import { and, desc, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { pageConfig, photo, photoVariant } from "@/src/db/schema";
import { getStorage } from "@/src/storage";
import { normalizeLoginDesign } from "@/src/lib/login-design";
import { notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const [cfg] = await db
    .select()
    .from(pageConfig)
    .where(and(eq(pageConfig.scope, "global"), eq(pageConfig.isDefault, true)))
    .limit(1);

  const login = normalizeLoginDesign(
    (cfg?.config as { login?: unknown } | null)?.login,
  );
  if (!login.photoId) return notFound();

  const [pickedPhoto] = await db
    .select()
    .from(photo)
    .where(eq(photo.id, login.photoId))
    .limit(1);
  if (!pickedPhoto || pickedPhoto.deletedAt) return notFound();

  const variants = await db
    .select()
    .from(photoVariant)
    .where(eq(photoVariant.photoId, pickedPhoto.id))
    .orderBy(desc(photoVariant.width));
  const variant =
    variants.find((item) => item.format === "webp" && item.sizeBucket === "large") ??
    variants.find((item) => item.format === "webp") ??
    variants[0];
  if (!variant) return notFound();

  const bytes = await getStorage().get(variant.storageKey);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": `image/${variant.format}`,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
