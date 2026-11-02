"use client";

import { useMemo } from "react";
import { ChefHat, Clock, ExternalLink, Gauge, Lightbulb, Refrigerator, Utensils } from "lucide-react";
import type { Recipe } from "@/types/database";
import { groupIngredients, scaleIngredients } from "@/lib/recipe-scaling";
import {
  ALLERGEN_LABELS,
  DIFFICULTY_LABELS,
  formatMinutes,
  parseRecipeDetails,
  type RecipeDetails,
} from "@/lib/recipe-details";
import { Stepper } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { safeHttpUrl } from "@/lib/safe-links";
import { RecipePlaceholder } from "./recipe-placeholder";

const formatNumber = (value: number | null) =>
  value === null ? null : value.toLocaleString("de-DE", { maximumFractionDigits: 1 });

const getSteps = (text: string | null) =>
  (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\d+[.)](?!\d)\s*/, ""))
    .filter(Boolean);

export function sourceHost(url: string | null) {
  const safeUrl = safeHttpUrl(url);
  return safeUrl ? new URL(safeUrl).hostname.replace(/^www\./, "") : null;
}

/**
 * Read-only recipe for cooking and planning. Shared by the app and the public
 * share page; `actions` and `footer` decide what the reader can do with it.
 */
export function RecipeBody({
  recipe,
  tags,
  servings,
  onServingsChange,
  heroActions,
  attribution,
  rating,
  balance,
  showNutrition = true,
}: {
  recipe: Pick<
    Recipe,
    "name" | "image_url" | "prep_time" | "calories" | "protein" | "carbs" | "fats" | "serving_size" | "ingredients" | "preparation_steps" | "source_url"
  > & { details?: unknown };
  tags: string[];
  servings: number;
  onServingsChange: (servings: number) => void;
  heroActions?: React.ReactNode;
  attribution?: React.ReactNode;
  // Own rating stars; only shown for the reader's own recipes.
  rating?: React.ReactNode;
  // "Ausgewogenheit" section, shown below the nutrition values.
  balance?: React.ReactNode;
  showNutrition?: boolean;
}) {
  const baseServings = recipe.serving_size > 0 ? recipe.serving_size : 1;
  const factor = servings / baseServings;
  const ingredients = useMemo(() => scaleIngredients(recipe.ingredients, factor), [recipe.ingredients, factor]);
  const steps = getSteps(recipe.preparation_steps);
  const host = sourceHost(recipe.source_url);
  const details = useMemo(() => parseRecipeDetails(recipe.details), [recipe.details]);
  const storage = details ? storageHints(details) : [];

  const nutrition = [
    { label: "kcal", value: recipe.calories, unit: "" },
    { label: "Protein", value: recipe.protein, unit: " g", accent: true },
    { label: "Carbs", value: recipe.carbs, unit: " g" },
    { label: "Fett", value: recipe.fats, unit: " g" },
  ].filter((item) => item.value !== null);

  return (
    <>
      <div className={cn("relative shrink-0 bg-brand-chip-neutral", recipe.image_url ? "h-[300px]" : "h-40")}>
        {recipe.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <RecipePlaceholder name={recipe.name} className="text-6xl" />
        )}
        {heroActions && (
          <div className="absolute inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] flex justify-between">
            {heroActions}
          </div>
        )}
      </div>

      <main className="relative -mt-[22px] space-y-5 rounded-t-[22px] bg-white px-4 pb-8 pt-5">
        <div className="space-y-2.5">
          {attribution}
          <h1 className="font-heading text-[26px] font-extrabold leading-[1.15] text-brand-ink">{recipe.name}</h1>
          {details?.description && <p className="text-[15px] leading-snug text-brand-secondary">{details.description}</p>}
          <div className="flex flex-wrap gap-1.5 text-[13px] font-semibold">
            {recipe.prep_time && (
              <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-brand-chip-neutral px-2.5 text-brand-ink">
                <Clock className="size-3.5" />
                {recipe.prep_time}
                {details?.active_minutes ? (
                  <span className="font-normal text-brand-secondary">· {formatMinutes(details.active_minutes)} aktiv</span>
                ) : null}
              </span>
            )}
            {details?.difficulty && (
              <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-brand-chip-neutral px-2.5 text-brand-ink">
                <Gauge className="size-3.5" />
                {DIFFICULTY_LABELS[details.difficulty]}
              </span>
            )}
            {tags.map((tag) => (
              <span key={tag} className="flex h-[30px] items-center rounded-full bg-brand-accent-bg px-2.5 text-brand-accent-dark">
                {tag}
              </span>
            ))}
            {host && (
              <a
                href={safeHttpUrl(recipe.source_url)!}
                target="_blank"
                rel="noreferrer"
                className="flex h-[30px] items-center gap-1.5 rounded-full bg-brand-chip-neutral px-2.5 text-brand-ink transition-transform active:scale-95"
              >
                <ExternalLink className="size-3.5" />
                {host}
              </a>
            )}
          </div>
          {rating}
        </div>

        {showNutrition && nutrition.length > 0 && (
          <section aria-label="Nährwerte pro Portion" className="space-y-1.5">
            <div className="grid grid-cols-4 gap-2">
              {nutrition.map((item) => (
                <div key={item.label} className="flex flex-col items-center rounded-[14px] bg-brand-stat-bg px-1.5 py-2.5">
                  <span className={cn("text-lg font-bold", item.accent ? "text-brand-accent-dark" : "text-brand-ink")}>
                    {formatNumber(item.value)}
                    {item.unit}
                  </span>
                  <span className="text-xs text-brand-secondary">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-brand-secondary">
              Pro Portion{details?.nutrition_estimated && " · aus den Zutaten geschätzt"}
            </p>
            {details?.nutrition_warning && (
              <p className="text-xs font-semibold text-[#8a5a00]">
                Kalorien und Makros passen nicht ganz zusammen, prüf die Werte am besten kurz.
              </p>
            )}
          </section>
        )}

        {balance}

        <section className="space-y-1">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-extrabold text-brand-ink">Zutaten</h2>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-brand-ink">Portionen</span>
              <Stepper value={servings} onChange={onServingsChange} min={1} max={24} label="Portionen" />
            </div>
          </div>
          {servings !== baseServings && (
            <p className="text-xs text-brand-secondary">
              Mengen umgerechnet vom Original ({formatNumber(baseServings)} {baseServings === 1 ? "Portion" : "Portionen"})
            </p>
          )}
          {groupIngredients(ingredients).map((group, groupIndex) => (
            <div key={groupIndex}>
              {group.group && (
                <h3 className="pb-0.5 pt-3 text-xs font-bold uppercase tracking-[0.06em] text-brand-accent-dark">
                  {group.group}
                </h3>
              )}
              <ul>
                {group.items.map((ingredient) => (
                  <li key={ingredient.id} className="flex gap-3 border-b border-brand-divider py-2.5 text-[15px] last:border-b-0">
                    <span
                      className={cn(
                        "w-[76px] shrink-0 font-bold",
                        servings !== baseServings ? "text-brand-accent-dark" : "text-brand-ink",
                      )}
                    >
                      {ingredient.amount}
                    </span>
                    <span className="text-brand-ink">{ingredient.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {details && details.equipment.length > 0 && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 font-heading text-lg font-extrabold text-brand-ink">
              <Utensils className="size-5 text-brand-accent-dark" />
              Das brauchst du
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {details.equipment.map((item) => (
                <li key={item} className="rounded-full bg-brand-chip-neutral px-3 py-1.5 text-[13px] font-semibold text-brand-ink">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {steps.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-extrabold text-brand-ink">Zubereitung</h2>
            <ol className="space-y-3.5">
              {steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-accent-bg text-[13px] font-bold text-brand-accent-dark">
                    {index + 1}
                  </span>
                  <p className="pt-0.5 text-[15px] leading-relaxed text-brand-ink">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {details && details.tips.length > 0 && (
          <section className="space-y-2 rounded-2xl bg-brand-accent-bg-light p-3.5">
            <h2 className="flex items-center gap-2 font-heading text-lg font-extrabold text-brand-ink">
              <Lightbulb className="size-5 text-brand-accent-dark" />
              Tipps
            </h2>
            <ul className="space-y-1.5">
              {details.tips.map((tip) => (
                <li key={tip} className="flex gap-2 text-[15px] leading-relaxed text-brand-ink">
                  <ChefHat className="mt-1 size-4 shrink-0 text-brand-accent-dark" />
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        )}

        {details && (details.allergens.length > 0 || storage.length > 0) && (
          <section className="space-y-1.5 text-[13px] leading-relaxed text-brand-secondary">
            {storage.length > 0 && (
              <p className="flex gap-1.5">
                <Refrigerator className="mt-0.5 size-3.5 shrink-0" />
                {storage.join(" · ")}
              </p>
            )}
            {details.allergens.length > 0 && (
              <p>
                <b className="font-semibold text-brand-ink">Allergene:</b>{" "}
                {details.allergens.map((allergen) => ALLERGEN_LABELS[allergen]).join(", ")}
                <span> (von der KI geschätzt, ohne Gewähr)</span>
              </p>
            )}
          </section>
        )}
      </main>
    </>
  );
}

function storageHints(details: RecipeDetails): string[] {
  return [
    details.fridge_days ? `Hält ${details.fridge_days} ${details.fridge_days === 1 ? "Tag" : "Tage"} im Kühlschrank` : null,
    details.freezable ? "lässt sich einfrieren" : null,
    details.portable ? "gut zum Mitnehmen" : null,
    details.leftovers ? "schmeckt auch aufgewärmt" : null,
  ].filter((hint): hint is string => Boolean(hint));
}

export function HeroButton({
  label,
  onClick,
  children,
  className,
}: {
  label?: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex size-11 touch-manipulation items-center justify-center rounded-full bg-white/90 text-brand-ink shadow-sm backdrop-blur transition-transform active:scale-90",
        className,
      )}
    >
      {children}
    </button>
  );
}
