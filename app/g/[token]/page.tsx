import { ClientGallery } from "@/components/client-gallery/client-gallery";

export const dynamic = "force-dynamic";

export default async function ClientGalleryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ClientGallery token={token} />;
}
