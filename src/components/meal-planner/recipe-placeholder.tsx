import { getRecipePlaceholder } from "@/lib/recipe-placeholder";
import { cn } from "@/lib/utils";

/**
 * Fills an image frame for a recipe without a photo. The emoji size comes from
 * `className` (e.g. "text-2xl"), so it fits thumbnails and the hero alike.
 */
export function RecipePlaceholder({ name, className }: { name: string; className?: string }) {
  const { emoji, hue } = getRecipePlaceholder(name);

  return (
    <span
      aria-hidden="true"
      className={cn("flex h-full w-full items-center justify-center", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 93%), hsl(${(hue + 40) % 360} 65% 85%))` }}
    >
      {emoji}
    </span>
  );
}
