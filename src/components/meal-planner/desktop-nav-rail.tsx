"use client";

import { BookOpen, Compass, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

export type DesktopPanelTab = "mine" | "discover" | "shopping";

const ITEMS: { value: DesktopPanelTab; label: string; Icon: typeof BookOpen }[] = [
  { value: "mine", label: "Rezepte", Icon: BookOpen },
  { value: "discover", label: "Entdecken", Icon: Compass },
  { value: "shopping", label: "Einkauf", Icon: ShoppingCart },
];

/**
 * Desktop counterpart of the mobile tab bar. It only switches the panel next
 * to the plan, so the plan stays in view and recipes can be dragged onto it.
 */
export function DesktopNavRail({
  value,
  onChange,
}: {
  value: DesktopPanelTab;
  onChange: (tab: DesktopPanelTab) => void;
}) {
  return (
    <nav
      aria-label="Bereiche"
      className="hidden w-[84px] shrink-0 flex-col items-center gap-1.5 border-r border-brand-card-border bg-white lg:flex"
    >
      <div aria-hidden="true" className="mb-2 flex h-[61px] w-full items-center justify-center border-b border-brand-card-border text-[26px]">
        🥗
      </div>
      {ITEMS.map(({ value: tab, label, Icon }) => {
        const active = tab === value;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            aria-pressed={active}
            className={cn(
              "flex h-[62px] w-[68px] flex-col items-center justify-center gap-1 rounded-[14px] text-[11px] font-bold transition-colors active:scale-95",
              active ? "text-brand-ink" : "text-brand-secondary hover:bg-black/[0.03]",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-11 items-center justify-center rounded-full transition-colors",
                active && "bg-brand-accent-bg text-brand-accent-dark",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.2 : 2} />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
