import { z } from "zod";
import { sql, eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, created, problem, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { folder, folderPhoto } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().nullable().optional(),
});

// GET — all folders (flat, with parentId + photo counts) for building the tree.
export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const folders = await db
    .select({
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
      coverPhotoId: folder.coverPhotoId,
      sortOrder: folder.sortOrder,
    })
    .from(folder)
    .orderBy(folder.sortOrder, folder.name);

  const counts = await db
    .select({
      folderId: folderPhoto.folderId,
      count: sql<number>`count(*)::int`,
    })
    .from(folderPhoto)
    .groupBy(folderPhoto.folderId);
  const countMap = new Map(counts.map((c) => [c.folderId, c.count]));

  return ok({
    data: folders.map((f) => ({ ...f, photoCount: countMap.get(f.id) ?? 0 })),
  });
}

// POST — create a folder (optionally nested under parentId).
export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const parsed = await parseJson(req, CreateSchema);
  if ("error" in parsed) return parsed.error;
  const { name, parentId } = parsed.data;

  if (parentId) {
    const parent = await db
      .select({ id: folder.id })
      .from(folder)
      .where(eq(folder.id, parentId))
      .limit(1);
    if (!parent.length) {
      return problem(422, "INVALID_PARENT", "Parent folder does not exist.");
    }
  }

  const id = newId();
  await db.insert(folder).values({
    id,
    name,
    parentId: parentId ?? null,
    createdBy: a.session.user.id,
  });

  await writeAudit({
    actorId: a.session.user.id,
    action: "folder.create",
    entityType: "folder",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { parentId: parentId ?? null },
  });

  return created({ id, name, parentId: parentId ?? null });
}
