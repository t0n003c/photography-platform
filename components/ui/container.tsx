import * as React from "react";
import { cn } from "@/src/lib/utils";

type ContainerProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Centered, max-width layout wrapper with responsive horizontal padding.
 * Server component.
 */
export function Container({ className, ...props }: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8",
        className,
      )}
      {...props}
    />
  );
}
