"use client";

import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubPageProps {
  title: string;
  // Small line under the title, e.g. how much of today's goal is left.
  subtitle?: string;
  description?: string;
  onBack: () => void;
  backDisabled?: boolean;
  // "muted": settings-style page with white cards on the app background.
  tone?: "white" | "muted";
  // Rendered at the right end of the header, e.g. edit/delete buttons.
  actions?: React.ReactNode;
  // Below the title row, inside the sticky header (search fields, filters).
  headerExtra?: React.ReactNode;
  // Pinned to the bottom of the viewport, e.g. the primary action of the page.
  footer?: React.ReactNode;
  onPaste?: React.ClipboardEventHandler<HTMLDivElement>;
  children: React.ReactNode;
}

export function SubPage({
  title,
  subtitle,
  description,
  onBack,
  backDisabled = false,
  tone = "white",
  actions,
  headerExtra,
  footer,
  onPaste,
  children,
}: SubPageProps) {
  const muted = tone === "muted";

  return (
    <div
      className={cn("flex min-h-dvh flex-col", muted ? "bg-brand-app-bg" : "bg-white")}
      onPaste={onPaste}
    >
      <header
        className={cn(
          "sticky top-0 z-40 pt-[env(safe-area-inset-top)]",
          muted ? "bg-brand-app-bg/90 backdrop-blur-lg" : "border-b border-brand-card-border bg-white",
        )}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center gap-1 px-2 py-2.5">
          <button
            type="button"
            onClick={onBack}
            disabled={backDisabled}
            aria-label="Zurück"
            className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-brand-ink transition-transform active:scale-90 active:bg-black/5 disabled:opacity-40"
          >
            <ChevronLeft className="size-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading text-lg font-extrabold text-brand-ink">{title}</h1>
            {subtitle && <p className="truncate text-xs text-brand-secondary">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </div>
        {headerExtra && <div className="mx-auto w-full max-w-2xl px-3 pb-3">{headerExtra}</div>}
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4">
        {description && <p className="text-sm leading-relaxed text-brand-secondary">{description}</p>}
        {children}
      </main>

      {footer && (
        <div className="sticky bottom-0 z-30 border-t border-brand-card-border bg-white shadow-[0_-6px_16px_rgba(28,43,34,0.06)]">
          <div className="mx-auto w-full max-w-2xl px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}
