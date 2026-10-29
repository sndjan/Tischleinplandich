"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Sheet that slides up from the bottom over a dimmed page. Tapping outside or
 * pressing Escape closes it.
 */
export function BottomSheet({ title, description, onClose, children }: BottomSheetProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div data-overlay className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute inset-0 animate-[fade-up_200ms_ease-out_both] bg-brand-ink/45"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-up relative flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl"
      >
        <div className="flex justify-center pt-2">
          <span className="h-[5px] w-10 rounded-full bg-[#dfe3e0]" />
        </div>
        <div className="flex items-start justify-between gap-3 px-4 pt-2">
          <div className="space-y-1">
            <h2 className="font-heading text-xl font-extrabold text-brand-ink">{title}</h2>
            {description && <p className="text-sm leading-relaxed text-brand-secondary">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-chip-neutral transition-transform active:scale-90"
          >
            <X className="size-4" strokeWidth={2.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">{children}</div>
      </section>
    </div>
  );
}
