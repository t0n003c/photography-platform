import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/topbar";
import { ToastProvider } from "@/components/ui/toast";

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[240px_1fr]">
        <aside className="hidden border-r md:block">
          <div className="flex h-14 items-center border-b px-4 font-semibold">
            Photography
          </div>
          <Sidebar />
        </aside>
        <div className="flex min-h-dvh flex-col">
          <Topbar user={user} />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
