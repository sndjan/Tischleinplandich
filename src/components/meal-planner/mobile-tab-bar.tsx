"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, ShoppingCart, BookOpen, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileTab = "plan" | "shopping" | "recipes";

const TABS: { value: MobileTab; label: string; Icon: typeof CalendarDays }[] = [
  { value: "plan", label: "Planer", Icon: CalendarDays },
  { value: "shopping", label: "Einkauf", Icon: ShoppingCart },
  { value: "recipes", label: "Rezepte", Icon: BookOpen },
];

const PILL_SHADOW =
  "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6),0_0_0_1px_rgba(28,43,34,0.05),0_8px_24px_rgba(28,43,34,0.14)] backdrop-blur-xl backdrop-saturate-150";

interface MobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onFeedback: () => void;
}

/**
 * Small floating pill: only the active tab shows its name, so more of the page
 * stays visible. Slightly see-through, with the content blurred behind it. The
 * green highlight slides from tab to tab while the names fold in and out.
 */
export function MobileTabBar({ activeTab, onTabChange, onFeedback }: MobileTabBarProps) {
  const buttonRefs = useRef<Partial<Record<MobileTab, HTMLButtonElement | null>>>({});
  const [highlight, setHighlight] = useState<{ left: number; width: number } | null>(null);

  // Follows the active button while its width animates, so the highlight moves
  // in step with the labels instead of jumping to the end position.
  useLayoutEffect(() => {
    const measure = () => {
      const button = buttonRefs.current[activeTab];
      if (button) setHighlight({ left: button.offsetLeft, width: button.offsetWidth });
    };

    measure();
    const observer = new ResizeObserver(measure);
    Object.values(buttonRefs.current).forEach((button) => button && observer.observe(button));
    return () => observer.disconnect();
  }, [activeTab]);

  return (
    <nav
      aria-label="Bereiche"
      className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-center gap-2 px-4 pointer-events-none lg:hidden"
    >
      <div className={cn("pointer-events-auto relative flex h-14 items-center gap-1 rounded-full bg-white/75 px-1.5", PILL_SHADOW)}>
        {highlight && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-1.5 h-11 rounded-full bg-brand-accent-dark"
            style={{ transform: `translateX(${highlight.left}px)`, width: highlight.width }}
          />
        )}
        {TABS.map(({ value, label, Icon }) => {
          const isActive = value === activeTab;

          return (
            <button
              key={value}
              ref={(element) => {
                buttonRefs.current[value] = element;
              }}
              type="button"
              onClick={() => {
                if (isActive) window.scrollTo({ top: 0, behavior: "smooth" });
                else onTabChange(value);
              }}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-11 min-w-12 touch-manipulation items-center justify-center rounded-full text-[13px] font-bold transition-[color,padding,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-95 motion-reduce:transition-none",
                isActive ? "pl-3 pr-4 text-white" : "px-3 text-[#7d8a83] active:bg-black/5",
                !highlight && isActive && "bg-brand-accent-dark",
              )}
            >
              <Icon className="size-[22px] shrink-0" strokeWidth={isActive ? 2.2 : 2} />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                  isActive ? "ml-1.5 max-w-24 opacity-100" : "ml-0 max-w-0 opacity-0",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onFeedback}
        aria-label="Feedback senden"
        className={cn(
          "pointer-events-auto flex size-14 touch-manipulation items-center justify-center rounded-full bg-white/75 text-[#7d8a83] transition-transform active:scale-90",
          PILL_SHADOW,
        )}
      >
        <MessageSquarePlus className="size-[22px]" strokeWidth={2} />
      </button>
    </nav>
  );
}
