"use client";

import * as React from "react";
import { cn } from "@/src/lib/utils";

// A menu label with no destination (linkType "none" or an unresolved target).
// Renders as a non-navigating button so clicking neither jumps the page nor
// 404s — it just briefly flashes the label as click feedback.
export function InertLabel({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const [flash, setFlash] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = () => {
    setFlash(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(false), 340);
  };

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      aria-disabled="true"
      onClick={trigger}
      className={cn(className, "cursor-default", flash && "menu-flash")}
    >
      {label}
    </button>
  );
}
