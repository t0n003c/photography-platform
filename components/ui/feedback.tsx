import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  ADMIN_ILLUSTRATIONS,
  type AdminIllustrationKey,
} from "@/src/lib/admin-illustrations";
import { cn } from "@/src/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  illustration,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: AdminIllustrationKey;
}) {
  const illustrationAsset = illustration
    ? ADMIN_ILLUSTRATIONS[illustration]
    : null;

  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      {illustrationAsset && (
        <picture className="mx-auto mb-6 block w-full max-w-sm sm:max-w-md">
          <source srcSet={illustrationAsset.webp} type="image/webp" />
          <img
            src={illustrationAsset.png}
            alt={illustrationAsset.alt}
            width={illustrationAsset.width}
            height={illustrationAsset.height}
            loading="lazy"
            decoding="async"
            className="h-auto w-full object-contain"
          />
        </picture>
      )}
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
