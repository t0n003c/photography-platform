"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/src/lib/utils";

// Modal built on the native <dialog> element (accessible focus/escape handling
// for free, zero dependencies).
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-h-[92dvh] w-[min(92vw,32rem)] overflow-hidden rounded-xl border bg-[hsl(var(--background))] p-0 text-[hsl(var(--foreground))] backdrop:bg-black/50",
        className,
      )}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="flex shrink-0 items-center justify-between border-b p-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 hover:bg-[hsl(var(--muted))]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}
