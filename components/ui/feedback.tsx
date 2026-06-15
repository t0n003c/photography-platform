import { Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
