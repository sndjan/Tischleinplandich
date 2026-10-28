"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Sample data for the landing page demo. Nothing here touches the real app or Supabase.

type RecipeId = "oats" | "egg" | "dal" | "bowl" | "veg" | "pasta" | "salmon" | "shakshuka";
type SlotKey = "breakfast" | "lunch" | "dinner";
type Ingredient = [name: string, quantity: number, unit: string];
type DemoRecipe = { name: string; kcal: number; protein: number; minutes: number; ingredients: Ingredient[] };
type DayPlan = Partial<Record<SlotKey, RecipeId>>;
type Tab = "plan" | "shop" | "recipes";

const RECIPES: Record<RecipeId, DemoRecipe> = {
  oats: { name: "Overnight Oats mit Beeren", kcal: 420, protein: 18, minutes: 5, ingredients: [["Haferflocken", 60, "g"], ["Naturjoghurt", 150, "g"], ["Beeren", 100, "g"]] },
  egg: { name: "Rührei auf Vollkornbrot", kcal: 450, protein: 26, minutes: 10, ingredients: [["Eier", 3, "Stk."], ["Vollkornbrot", 2, "Scheiben"], ["Schnittlauch", 1, "Bund"]] },
  dal: { name: "Linsen-Dal mit Reis", kcal: 610, protein: 24, minutes: 30, ingredients: [["Rote Linsen", 120, "g"], ["Kokosmilch", 200, "ml"], ["Reis", 80, "g"]] },
  bowl: { name: "Hähnchen-Bowl", kcal: 680, protein: 45, minutes: 25, ingredients: [["Hähnchenbrust", 150, "g"], ["Reis", 80, "g"], ["Paprika", 1, "Stk."]] },
  veg: { name: "Ofengemüse mit Feta", kcal: 540, protein: 22, minutes: 35, ingredients: [["Paprika", 2, "Stk."], ["Zucchini", 1, "Stk."], ["Feta", 100, "g"]] },
  pasta: { name: "Pasta Pomodoro", kcal: 650, protein: 20, minutes: 20, ingredients: [["Spaghetti", 125, "g"], ["Dosentomaten", 400, "g"], ["Basilikum", 1, "Bund"]] },
  salmon: { name: "Lachs mit Ofenkartoffeln", kcal: 620, protein: 38, minutes: 40, ingredients: [["Lachsfilet", 150, "g"], ["Kartoffeln", 300, "g"], ["Zitrone", 1, "Stk."]] },
  shakshuka: { name: "Shakshuka mit Feta", kcal: 480, protein: 27, minutes: 25, ingredients: [["Eier", 3, "Stk."], ["Dosentomaten", 400, "g"], ["Paprika", 1, "Stk."], ["Feta", 50, "g"]] },
};

const BASE_LIBRARY: RecipeId[] = ["oats", "egg", "dal", "bowl", "veg", "pasta", "salmon"];
const IMPORTED_RECIPE: RecipeId = "shakshuka";
const SLOTS: [SlotKey, string][] = [["breakfast", "Frühstück"], ["lunch", "Mittagessen"], ["dinner", "Abendessen"]];
const CHOICES: Record<SlotKey, RecipeId[]> = { breakfast: ["oats", "egg"], lunch: ["dal", "bowl", "veg"], dinner: ["pasta", "salmon", "veg"] };
const DAYS: [short: string, long: string][] = [["Mo", "Montag"], ["Di", "Dienstag"], ["Mi", "Mittwoch"], ["Do", "Donnerstag"], ["Fr", "Freitag"], ["Sa", "Samstag"], ["So", "Sonntag"]];
const START_PLAN: DayPlan[] = [{ breakfast: "oats", lunch: "bowl", dinner: "pasta" }, { breakfast: "egg", dinner: "salmon" }, {}, {}, {}, {}, {}];
const IMPORT_STEPS = ["Seite wird gelesen …", "Zutaten & Mengen erkannt …", "Nährwerte berechnet …"];
const IMPORT_STEP_MS = 800;
const TARGETS = { kcal: 2000, protein: 110 };
const TABS: [Tab, string][] = [["plan", "Planer"], ["shop", "Einkauf"], ["recipes", "Rezepte"]];

function formatQuantity(quantity: number, unit: string) {
  if (unit === "g" && quantity >= 1000) return `${(quantity / 1000).toLocaleString("de-DE")} kg`;
  if (unit === "ml" && quantity >= 1000) return `${(quantity / 1000).toLocaleString("de-DE")} l`;
  return `${quantity} ${unit}`;
}

function recipeMeta(recipe: DemoRecipe, withProtein = true) {
  return [`${recipe.kcal} kcal`, withProtein && `${recipe.protein} g Protein`, `${recipe.minutes} Min.`].filter(Boolean).join(" · ");
}

export function LandingDemo() {
  const [tab, setTab] = useState<Tab>("plan");
  const [day, setDay] = useState(1);
  const [plan, setPlan] = useState<DayPlan[]>(START_PLAN);
  const [picking, setPicking] = useState<SlotKey | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [library, setLibrary] = useState<RecipeId[]>(BASE_LIBRARY);
  const [openRecipe, setOpenRecipe] = useState<RecipeId>("dal");
  const [importStep, setImportStep] = useState(-1);
  const [importUrl, setImportUrl] = useState("");
  const [exported, setExported] = useState(false);
  const importTimers = useRef<number[]>([]);

  useEffect(() => () => importTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const assign = (dayIndex: number, slot: SlotKey, recipe: RecipeId | null) => {
    setPlan((current) =>
      current.map((dayPlan, index) => {
        if (index !== dayIndex) return dayPlan;
        const next = { ...dayPlan };
        if (recipe) next[slot] = recipe;
        else delete next[slot];
        return next;
      }),
    );
    setPicking(null);
  };

  const runImport = () => {
    if (importStep >= 0) return;
    setExported(false);
    setImportStep(0);
    importTimers.current = [
      window.setTimeout(() => setImportStep(1), IMPORT_STEP_MS),
      window.setTimeout(() => setImportStep(2), IMPORT_STEP_MS * 2),
      window.setTimeout(() => {
        setImportStep(-1);
        setImportUrl("");
        setLibrary((current) => (current.includes(IMPORTED_RECIPE) ? current : [IMPORTED_RECIPE, ...current]));
        setOpenRecipe(IMPORTED_RECIPE);
      }, IMPORT_STEP_MS * 3),
    ];
  };

  const totals = useMemo(() => {
    let kcal = 0;
    let protein = 0;
    for (const id of Object.values(plan[day])) {
      kcal += RECIPES[id].kcal;
      protein += RECIPES[id].protein;
    }
    return { kcal, protein };
  }, [plan, day]);

  // Same idea as the real shopping list: identical ingredients across the week add up.
  const shopping = useMemo(() => {
    const byKey = new Map<string, { key: string; name: string; unit: string; quantity: number }>();
    for (const dayPlan of plan) {
      for (const id of Object.values(dayPlan)) {
        for (const [name, quantity, unit] of RECIPES[id].ingredients) {
          const key = `${name}|${unit}`;
          const entry = byKey.get(key) ?? { key, name, unit, quantity: 0 };
          entry.quantity += quantity;
          byKey.set(key, entry);
        }
      }
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [plan]);

  const openItems = shopping.filter((item) => !checked[item.key]);
  const mealCount = plan.reduce((sum, dayPlan) => sum + Object.keys(dayPlan).length, 0);
  const doneCount = shopping.length - openItems.length;
  const detail = RECIPES[openRecipe];
  const dayName = DAYS[day][1];

  return (
    <div className="overflow-hidden rounded-[32px] border border-brand-card-border bg-white shadow-[0_30px_60px_-30px_rgba(28,43,34,0.22)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-divider bg-brand-app-bg-alt px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="rounded-full bg-brand-highlight px-3 py-1.5 text-[13px] font-bold text-brand-ink">Interaktive Demo</span>
          <h2 id="demo-heading" className="text-sm font-medium text-brand-secondary">
            Beispieldaten · nichts wird gespeichert
          </h2>
        </div>
        <div role="tablist" aria-label="Bereiche der Demo" className="flex h-11 rounded-full bg-brand-chip-neutral p-[3px]">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => {
                setTab(value);
                setPicking(null);
              }}
              className={cn(
                "rounded-full px-[18px] text-sm font-bold transition-all",
                tab === value ? "bg-white text-brand-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-brand-secondary",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[620px] p-4 sm:p-6">
        {tab === "plan" && (
          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-0 flex-[999_1_520px]">
              <div className="mb-3.5 grid grid-cols-7 gap-1.5">
                {DAYS.map(([short], index) => (
                  <button
                    key={short}
                    type="button"
                    aria-pressed={index === day}
                    aria-label={`${DAYS[index][1]}, ${Object.keys(plan[index]).length} von 3 Mahlzeiten`}
                    onClick={() => {
                      setDay(index);
                      setPicking(null);
                    }}
                    className={cn(
                      "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[14px] py-2",
                      index === day ? "bg-brand-accent-dark text-white" : "bg-brand-accent-bg-light text-brand-ink",
                    )}
                  >
                    <span className="text-sm font-bold">{short}</span>
                    <span className={cn("text-[11px]", index === day ? "opacity-90" : "text-brand-secondary")}>
                      {Object.keys(plan[index]).length}/3
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {SLOTS.map(([slot, label]) => {
                  const id = plan[day][slot];
                  const recipe = id ? RECIPES[id] : null;
                  const options = library.includes(IMPORTED_RECIPE) && slot !== "lunch" ? [...CHOICES[slot], IMPORTED_RECIPE] : CHOICES[slot];
                  return (
                    <div key={slot} className="rounded-[18px] border border-brand-card-border bg-white px-3.5 py-3">
                      <div className="flex items-center gap-3.5">
                        <span className="w-[88px] flex-none text-xs font-bold uppercase tracking-[0.06em] text-brand-tertiary sm:w-[104px]">
                          {label}
                        </span>
                        {recipe ? (
                          <>
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-bold">{recipe.name}</p>
                              <p className="mt-0.5 text-xs text-brand-secondary">{recipeMeta(recipe)}</p>
                            </div>
                            <button
                              type="button"
                              aria-label={`${recipe.name} entfernen`}
                              onClick={() => assign(day, slot, null)}
                              className="flex size-11 flex-none items-center justify-center rounded-full bg-brand-chip-neutral text-brand-secondary"
                            >
                              <X className="size-4" aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            aria-expanded={picking === slot}
                            onClick={() => setPicking(picking === slot ? null : slot)}
                            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-brand-icon-muted bg-brand-app-bg-alt text-sm font-bold text-brand-accent-dark"
                          >
                            <Plus className="size-4" strokeWidth={2.4} aria-hidden="true" />
                            Rezept hinzufügen
                          </button>
                        )}
                      </div>
                      {!recipe && picking === slot && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {options.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => assign(day, slot, option)}
                              className="min-h-11 flex-[1_1_180px] rounded-xl border border-brand-today-border bg-brand-accent-bg-light px-3 py-2.5 text-left text-brand-ink"
                            >
                              <span className="block text-sm font-bold">{RECIPES[option].name}</span>
                              <span className="mt-0.5 block text-xs text-brand-secondary">{recipeMeta(RECIPES[option], false)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-5 gap-y-3 rounded-[18px] bg-brand-stat-bg p-3.5">
                <NutritionBar label={`${dayName} · kcal`} value={`${totals.kcal.toLocaleString("de-DE")} / 2.000`} ratio={totals.kcal / TARGETS.kcal} />
                <NutritionBar label="Protein" value={`${totals.protein} / ${TARGETS.protein} g`} ratio={totals.protein / TARGETS.protein} dark />
              </div>
            </div>

            <aside aria-label="Einkaufsliste (Vorschau)" className="min-w-0 flex-[1_1_300px] rounded-[22px] bg-brand-app-bg p-5">
              <div className="mb-1 flex items-center justify-between gap-2.5">
                <h3 className="font-heading text-xl font-black">Einkaufsliste</h3>
                <button type="button" onClick={() => setTab("shop")} className="min-h-11 px-1 text-sm font-bold text-brand-accent-dark">
                  Alle ansehen
                </button>
              </div>
              <p className="mb-2 text-[13px] text-brand-secondary">
                {mealCount} Mahlzeiten geplant · {openItems.length} Zutaten offen
              </p>
              <ul>
                {openItems.slice(0, 7).map((item) => (
                  <li key={item.key} className="flex justify-between gap-3 border-b border-[#ebeae5] px-0.5 py-2.5 text-[15px]">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-brand-secondary">{formatQuantity(item.quantity, item.unit)}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )}

        {tab === "shop" && (
          <div className="mx-auto max-w-[760px]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-heading text-[26px] font-black">Einkaufsliste dieser Woche</h3>
              <p className="text-sm text-brand-secondary">
                {doneCount} von {shopping.length} abgehakt
              </p>
            </div>
            <div className="mb-[18px] mt-3.5 h-2 overflow-hidden rounded-full bg-brand-track">
              <div
                className="h-2 rounded-full bg-brand-accent transition-[width]"
                style={{ width: `${shopping.length ? Math.round((doneCount / shopping.length) * 100) : 0}%` }}
              />
            </div>
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-7">
              {shopping.map((item) => {
                const done = Boolean(checked[item.key]);
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      aria-pressed={done}
                      onClick={() => setChecked((current) => ({ ...current, [item.key]: !done }))}
                      className="flex min-h-12 w-full items-center gap-3 border-b border-brand-divider px-0.5 py-2.5 text-left"
                    >
                      <span
                        className={cn(
                          "flex size-[22px] flex-none items-center justify-center rounded-[7px] border-2",
                          done ? "border-brand-accent bg-brand-accent" : "border-brand-icon-muted",
                        )}
                      >
                        {done && <Check className="size-3.5 text-white" strokeWidth={3} aria-hidden="true" />}
                      </span>
                      <span className={cn("flex-1 text-[15px]", done ? "text-brand-tertiary line-through" : "font-medium")}>
                        {item.name}
                      </span>
                      <span className="text-sm text-brand-secondary">{formatQuantity(item.quantity, item.unit)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-[18px] text-sm text-brand-secondary">
              Gleiche Zutaten aus allen Rezepten der Woche werden zusammengerechnet.
            </p>
          </div>
        )}

        {tab === "recipes" && (
          <div className="flex flex-wrap items-start gap-6">
            <div className="min-w-0 flex-[999_1_520px]">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  runImport();
                }}
                className="rounded-[20px] border border-brand-today-border bg-brand-accent-bg-light p-4"
              >
                <label htmlFor="demo-import-url" className="mb-2 block text-sm font-bold">
                  Rezept per KI importieren
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="demo-import-url"
                    type="url"
                    value={importUrl}
                    onChange={(event) => setImportUrl(event.target.value)}
                    placeholder="Link, z. B. von einem Foodblog, einfügen"
                    className="min-h-12 min-w-0 flex-[1_1_240px] rounded-xl border border-brand-input-border bg-white px-3.5 text-[15px] text-brand-ink"
                  />
                  {importStep < 0 ? (
                    <button
                      type="submit"
                      className="flex min-h-12 items-center gap-2 rounded-xl bg-brand-accent-dark px-[18px] text-[15px] font-bold text-white"
                    >
                      <Sparkles className="size-[18px]" aria-hidden="true" />
                      Importieren
                    </button>
                  ) : (
                    <p role="status" className="flex min-h-12 animate-soft-pulse items-center px-1.5 text-[15px] font-bold text-brand-accent-dark motion-reduce:animate-none">
                      {IMPORT_STEPS[importStep]}
                    </p>
                  )}
                </div>
                <p className="mt-2 text-[13px] text-brand-secondary">
                  Auch Fotos und PDFs funktionieren. In der Demo wird ein Beispielrezept erzeugt.
                </p>
              </form>

              <div className="mb-3 mt-5 flex items-center justify-between gap-3">
                <h3 className="font-heading text-xl font-black">
                  Meine Rezepte <span className="font-bold text-brand-tertiary">{library.length}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setExported(true)}
                  className="flex min-h-11 items-center gap-2 rounded-full border border-brand-input-border bg-white px-3.5 text-sm font-bold"
                >
                  <Download className="size-4" aria-hidden="true" />
                  Exportieren
                </button>
              </div>
              {exported && (
                <p role="status" className="mb-3 rounded-xl bg-brand-ink px-3.5 py-3 text-sm text-white">
                  {library.length} Rezepte als Markdown (ZIP) exportiert – in der Demo nur simuliert.
                </p>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                {library.map((id) => {
                  const recipe = RECIPES[id];
                  const selected = id === openRecipe;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setOpenRecipe(id)}
                      className={cn(
                        "flex min-h-[84px] items-center gap-3 rounded-2xl border-2 p-3 text-left text-brand-ink",
                        selected ? "border-brand-accent bg-brand-accent-bg-light" : "border-brand-card-border bg-white",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-11 flex-none items-center justify-center rounded-xl font-heading text-lg font-black",
                          selected ? "bg-brand-accent-dark text-white" : "bg-brand-accent-bg text-brand-accent-dark",
                        )}
                      >
                        {recipe.name.charAt(0)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{recipe.name}</span>
                        <span className="mt-0.5 block text-xs text-brand-secondary">{recipeMeta(recipe, false)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <article aria-label="Rezeptdetails" className="min-w-0 flex-[1_1_300px] rounded-[22px] bg-brand-app-bg p-5">
              {openRecipe === IMPORTED_RECIPE && (
                <p className="mb-2.5 inline-block rounded-full bg-brand-highlight px-2.5 py-1 text-xs font-bold">Neu per KI importiert</p>
              )}
              <h3 className="font-heading text-[22px] font-black">{detail.name}</h3>
              <p className="mb-4 mt-1.5 text-sm text-brand-secondary">{recipeMeta(detail)}</p>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-[0.06em] text-brand-tertiary">Zutaten</h4>
              <ul className="mb-5">
                {detail.ingredients.map(([name, quantity, unit]) => (
                  <li key={name} className="flex justify-between border-b border-[#ebeae5] py-2 text-[15px]">
                    <span>{name}</span>
                    <span className="text-brand-secondary">{formatQuantity(quantity, unit)}</span>
                  </li>
                ))}
              </ul>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-brand-tertiary">Einplanen am {dayName}</h4>
              <div className="flex flex-wrap gap-1.5">
                {SLOTS.map(([slot, label]) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      assign(day, slot, openRecipe);
                      setTab("plan");
                    }}
                    className="min-h-11 flex-[1_1_90px] rounded-xl bg-brand-accent-dark text-[13px] font-bold text-white"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </article>
          </div>
        )}
      </div>
    </div>
  );
}

function NutritionBar({ label, value, ratio, dark }: { label: string; value: string; ratio: number; dark?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-[13px] font-bold">
        <span>{label}</span>
        <span className="font-medium text-brand-secondary">{value}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-track">
        <div
          className={cn("h-2 rounded-full transition-[width]", dark ? "bg-brand-accent-dark" : "bg-brand-accent")}
          style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
        />
      </div>
    </div>
  );
}
