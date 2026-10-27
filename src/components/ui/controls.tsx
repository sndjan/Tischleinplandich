"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  label = "Portionen",
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-brand-chip-neutral p-[3px]">
      <button
        type="button"
        aria-label={`Weniger ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="flex size-9 items-center justify-center rounded-full bg-white text-brand-ink transition-transform active:scale-90 disabled:opacity-40"
      >
        <Minus className="size-4" strokeWidth={2.5} />
      </button>
      <span className="min-w-7 text-center text-[15px] font-bold" aria-live="polite">
        {value.toLocaleString("de-DE")}
      </span>
      <button
        type="button"
        aria-label={`Mehr ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="flex size-9 items-center justify-center rounded-full bg-white text-brand-ink transition-transform active:scale-90 disabled:opacity-40"
      >
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-brand-accent-dark" : "bg-brand-disabled",
      )}
    >
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="absolute inset-0 m-0 cursor-pointer opacity-0"
      />
      <span
        className={cn(
          "pointer-events-none absolute top-[3px] size-[22px] rounded-full bg-white shadow-sm transition-all",
          checked ? "left-[23px]" : "left-[3px]",
        )}
      />
    </span>
  );
}
