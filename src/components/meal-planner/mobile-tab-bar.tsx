"use client";

import { CalendarDays, ShoppingCart, BookOpen, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileTab = "plan" | "shopping" | "recipes";

const TABS: { value: MobileTab; label: string; Icon: typeof CalendarDays }[] = [
  { value: "plan", label: "Planer", Icon: CalendarDays },
  { value: "shopping", label: "Einkauf", Icon: ShoppingCart },
  { value: "recipes", label: "Rezepte", Icon: BookOpen },
];

// Fixed sizes (px): one active tab plus two inactive ones always add up to the
// same width, so the bar never changes size and the highlight's position is
// known up front instead of measured while things move.
const ACTIVE_WIDTH = 108;
const INACTIVE_WIDTH = 48;
const GAP = 4;
const PADDING = 6;
const EASE = "duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

const PILL_SHADOW =
  "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6),0_0_0_1px_rgba(28,43,34,0.05),0_8px_24px_rgba(28,43,34,0.14)] backdrop-blur-xl backdrop-saturate-150";

interface MobileTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  feedbackOpen: boolean;
  onFeedback: () => void;
}

/**
 * Small floating pill: only the active tab shows its name, so more of the page
 * stays visible. Slightly see-through, with the content blurred behind it. The
 * green highlight slides to the new tab; the old name fades out and the new
 * one fades in.
 */
export function MobileTabBar({ activeTab, onTabChange, feedbackOpen, onFeedback }: MobileTabBarProps) {
  const activeIndex = TABS.findIndex((tab) => tab.value === activeTab);

  return (
    <nav
      aria-label="Bereiche"
      className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-center gap-2 px-4 pointer-events-none lg:hidden"
    >
      <div
        className={cn("pointer-events-auto relative flex h-14 items-center rounded-full bg-white/75", PILL_SHADOW)}
        style={{ gap: GAP, paddingInline: PADDING }}
      >
        <span
          aria-hidden="true"
          className={cn("absolute left-0 top-1.5 h-11 rounded-full bg-brand-accent-dark transition-transform", EASE)}
          style={{
            width: ACTIVE_WIDTH,
            transform: `translateX(${PADDING + activeIndex * (INACTIVE_WIDTH + GAP)}px)`,
          }}
        />
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
              style={{ width: isActive ? ACTIVE_WIDTH : INACTIVE_WIDTH }}
              className={cn(
                // Icon keeps its spot at the left; the name is clipped while the tab is narrow.
                "relative flex h-11 shrink-0 touch-manipulation items-center overflow-hidden rounded-full pl-[13px] text-[13px] font-bold transition-[width,color]",
                EASE,
                isActive ? "text-white" : "text-[#7d8a83] active:bg-black/5",
              )}
            >
              <Icon className="size-[22px] shrink-0" strokeWidth={isActive ? 2.2 : 2} />
              <span
                className={cn(
                  "ml-1.5 whitespace-nowrap transition-opacity motion-reduce:transition-none",
                  // Out quickly, in once the highlight has mostly arrived.
                  isActive ? "opacity-100 delay-150 duration-200" : "opacity-0 duration-100",
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
        data-feedback-trigger
        aria-label="Feedback senden"
        aria-expanded={feedbackOpen}
        className={cn(
          "pointer-events-auto flex size-14 touch-manipulation items-center justify-center rounded-full transition-[transform,background-color,color] active:scale-90",
          PILL_SHADOW,
          feedbackOpen ? "bg-brand-accent-dark text-white" : "bg-white/75 text-[#7d8a83]",
        )}
      >
        <MessageSquarePlus className="size-[22px]" strokeWidth={2} />
      </button>
    </nav>
  );
}
