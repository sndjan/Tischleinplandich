"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubPageProps {
  title: string;
  description?: string;
  onBack: () => void;
  backDisabled?: boolean;
  // Rendered at the right end of the header, e.g. edit/delete buttons.
  actions?: React.ReactNode;
  // Pinned to the bottom of the viewport, e.g. the primary action of the page.
  footer?: React.ReactNode;
  onPaste?: React.ClipboardEventHandler<HTMLDivElement>;
  children: React.ReactNode;
}

export function SubPage({
  title,
  description,
  onBack,
  backDisabled = false,
  actions,
  footer,
  onPaste,
  children,
}: SubPageProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-white" onPaste={onPaste}>
      <header className="sticky top-0 z-40 border-b border-brand-card-border bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-2 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={onBack}
            disabled={backDisabled}
            aria-label="Zurück"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="font-heading min-w-0 flex-1 truncate text-lg font-bold text-brand-ink">
            {title}
          </h1>
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-4">
        {description && <p className="text-sm text-brand-tertiary">{description}</p>}
        {children}
      </main>

      {footer && (
        <div className="sticky bottom-0 z-30 border-t border-brand-card-border bg-white">
          <div className="mx-auto w-full max-w-2xl px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}
