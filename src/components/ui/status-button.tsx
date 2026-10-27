"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionStatus = "idle" | "pending" | "success";

const SUCCESS_HOLD_MS = 900;

/**
 * Tracks an async action for a StatusButton: pending while it runs, then a short
 * success state. `run` resolves after the success state was shown, so callers can
 * close the screen right after.
 */
export function useActionStatus() {
  const [status, setStatus] = React.useState<ActionStatus>("idle");
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = React.useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setStatus("pending");

    try {
      const result = await action();
      if (mountedRef.current) setStatus("success");
      await new Promise((resolve) => setTimeout(resolve, SUCCESS_HOLD_MS));
      if (mountedRef.current) setStatus("idle");
      return result;
    } catch (error) {
      if (mountedRef.current) setStatus("idle");
      throw error;
    }
  }, []);

  return { status, run };
}

interface StatusButtonProps extends React.ComponentProps<typeof Button> {
  status: ActionStatus;
  pendingLabel: string;
  successLabel: string;
}

/**
 * A button that shows a spinner while its action runs and a checkmark after it
 * succeeded, keeping its width so the layout doesn't jump.
 */
export function StatusButton({
  status,
  pendingLabel,
  successLabel,
  children,
  className,
  onClick,
  ...props
}: StatusButtonProps) {
  const busy = status !== "idle";

  return (
    <Button
      {...props}
      // Not `disabled` while busy: that would fade the success state to half opacity.
      aria-disabled={busy || undefined}
      onClick={busy ? undefined : onClick}
      aria-live="polite"
      className={cn(
        busy && "pointer-events-none",
        status === "pending" && "opacity-85",
        status === "success" && "bg-brand-accent-dark",
        className,
      )}
    >
      {status === "pending" ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : status === "success" ? (
        <>
          <Check className="animate-pop-in size-5" strokeWidth={3} />
          {successLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
