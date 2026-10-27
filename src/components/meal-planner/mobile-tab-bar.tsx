"use client";

import { CalendarDays, ShoppingCart, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileTab = "plan" | "shopping" | "recipes";

const TABS: { value: MobileTab; label: string; Icon: typeof CalendarDays }[] = [
  { value: "plan", label: "Planer", Icon: CalendarDays },
  { value: "shopping", label: "Einkauf", Icon: ShoppingCart },
  { value: "recipes", label: "Rezepte", Icon: BookOpen },
];

interface MobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

/**
 * Small floating pill: only the active tab shows its name, so more of the page
 * stays visible. Slightly see-through, with the content blurred behind it.
 */
export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
  return (
    <nav
      aria-label="Bereiche"
      className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 pointer-events-none lg:hidden"
    >
      <div className="pointer-events-auto flex h-14 items-center gap-1 rounded-full bg-white/75 px-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6),0_0_0_1px_rgba(28,43,34,0.05),0_8px_24px_rgba(28,43,34,0.14)] backdrop-blur-xl backdrop-saturate-150">
        {TABS.map(({ value, label, Icon }) => {
          const isActive = value === activeTab;

          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                if (isActive) window.scrollTo({ top: 0, behavior: "smooth" });
                else onTabChange(value);
              }}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-11 touch-manipulation items-center justify-center gap-1.5 rounded-full text-[13px] font-bold transition-all duration-200 active:scale-95",
                isActive
                  ? "bg-brand-accent-dark pl-3 pr-4 text-white"
                  : "w-12 text-[#7d8a83] active:bg-black/5",
              )}
            >
              <Icon className="size-[22px] shrink-0" strokeWidth={isActive ? 2.2 : 2} />
              {isActive && <span className="animate-fade-up">{label}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
