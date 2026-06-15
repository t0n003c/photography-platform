"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/src/lib/utils";

type Toast = { id: number; message: string; tone: "info" | "success" | "error" };
type ToastCtx = {
  toast: (message: string, tone?: Toast["tone"]) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    (message: string, tone: Toast["tone"] = "info") => {
      const id = ++counter;
      setToasts((t) => [...t, { id, message, tone }]);
      setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== id)),
        4000,
      );
    },
    [],
  );

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg",
              t.tone === "success" &&
                "border-green-300 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
              t.tone === "error" &&
                "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
              t.tone === "info" && "bg-[hsl(var(--background))]",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
