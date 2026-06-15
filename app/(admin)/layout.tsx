import { redirect } from "next/navigation";
import { getSession } from "@/src/auth/session";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

// Server-side auth gate for the entire admin surface. Unauthenticated users are
// redirected to /login; any authenticated role (owner/admin/staff) may enter the
// shell — per-action role checks live in the API handlers.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const role = (session.user.role ?? "staff").split(",")[0]!.trim();

  return (
    <AdminShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role,
      }}
    >
      {children}
    </AdminShell>
  );
}
