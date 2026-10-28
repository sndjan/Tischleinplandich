"use client";

import { cn } from "@/lib/utils";

/** Grey track with the selected tab as a white chip. */
export function SegmentedTabs<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid h-10 rounded-xl bg-brand-chip-neutral p-[3px] text-sm font-bold"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "truncate rounded-[10px] px-1 transition-all active:scale-[0.97]",
            value === option.value
              ? "bg-white text-brand-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              : "text-brand-secondary",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
