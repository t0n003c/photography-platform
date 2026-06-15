import { and, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { pageConfig } from "@/src/db/schema";
import { ok, notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

const SCOPES = ["home", "gallery", "category", "location", "about", "global"] as const;
type Scope = (typeof SCOPES)[number];

function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

// Public default page-config for a given scope.
export async function GET(req: Request, ctx: { params: Promise<{ scope: string }> }) {
  const { scope } = await ctx.params;
  if (!isScope(scope)) return notFound();

  const rows = await db
    .select()
    .from(pageConfig)
    .where(and(eq(pageConfig.scope, scope), eq(pageConfig.isDefault, true)))
    .limit(1);

  const row = rows[0];
  if (row) return ok(row);

  return ok({
    scope,
    gridType: "justified",
    spacing: "normal",
    theme: "auto",
    config: {},
  });
}
