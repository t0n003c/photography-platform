import { notFound } from "next/navigation";
import { getSession } from "@/src/auth/session";
import {
  getPageByIdAdmin,
  getPageDraft,
} from "@/src/db/queries/pages";
import { parseBlocks } from "@/src/lib/blocks";
import { BlockRenderer } from "@/components/blocks/block-renderer";

export const dynamic = "force-dynamic";

// Admin-only live preview of a builder page (any status), rendering the editor's
// unsaved draft blocks when present. Wrapped in the public chrome (header/footer)
// for a faithful preview. Non-admins get a 404 (no existence disclosure).
export default async function PagePreview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { id } = await params;
  const pg = await getPageByIdAdmin(id);
  if (!pg) notFound();

  const draft = await getPageDraft(id);
  const blocks = parseBlocks(draft ? draft.blocks : pg.blocks);

  return (
    <div className="py-4">
      <BlockRenderer blocks={blocks} preview />
    </div>
  );
}
