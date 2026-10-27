"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A textarea that grows with its content, for text that should look like plain
 * text until it is tapped (recipe name, steps).
 */
export const AutoTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, value, onChange, ...props }, forwardedRef) => {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resize = React.useCallback(() => {
    const element = innerRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(resize, [value, resize]);

  return (
    <textarea
      {...props}
      ref={(element) => {
        innerRef.current = element;
        if (typeof forwardedRef === "function") forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      }}
      rows={1}
      value={value}
      onChange={(event) => {
        onChange?.(event);
        resize();
      }}
      className={cn(
        "block w-full resize-none overflow-hidden rounded-lg border-0 bg-transparent p-0 outline-none transition-colors placeholder:text-brand-muted focus:bg-brand-accent-bg-light focus:ring-2 focus:ring-brand-accent-bg",
        className,
      )}
    />
  );
});
AutoTextarea.displayName = "AutoTextarea";
