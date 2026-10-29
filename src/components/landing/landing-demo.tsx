"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Camera,
  Check,
  ChefHat,
  ChevronLeft,
  ClipboardPaste,
  Download,
  FileText,
  Lightbulb,
  Link2,
  PencilLine,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import type { MealType, Recipe } from "@/types/database";
import type { RecipeStreamStage } from "@/lib/recipe-draft";
import { MEAL_TYPE_LABELS } from "@/lib/meal-labels";
import { generateShoppingListFromPlannedMeals } from "@/lib/shopping-list";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/skeleton";
import { AddMealButton } from "@/components/meal-planner/add-meal-button";
import { DaySummary, sumMealNutrition } from "@/components/meal-planner/day-summary";
import { MealSlotCard } from "@/components/meal-planner/meal-slot-card";
import { RecipeAiProgress } from "@/components/meal-planner/recipe-ai-progress";
import { HeroButton, RecipeBody } from "@/components/meal-planner/recipe-body";
import { RecipeList } from "@/components/meal-planner/recipe-list";
import { StaticScreenStackProvider, type Screen } from "@/components/meal-planner/screen-stack";
import { SegmentedTabs } from "@/components/meal-planner/segmented-tabs";
import { ShoppingList } from "@/components/meal-planner/shopping-list";
import { SubPage } from "@/components/meal-planner/sub-page";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  DEMO_PANTRY_STAPLES,
  DEMO_RECIPES,
  DEMO_TAGS_BY_ID,
  DEMO_TARGETS,
  IMPORT_LINK,
  IMPORTED_RECIPE,
  IMPORTED_RECIPE_ID,
  IMPORTED_TAGS,
  importedDraft,
  initialDemoMeals,
  type DemoMeal,
} from "./demo-data";

// The planner's own components running on sample data. Screens that need the
// database (adding a meal, a recipe, the AI import) are rebuilt here with the
// same building blocks and work only on local state.

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const SHORT_DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const FIXED_MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const IMPORT_STEP_MS = 900;
const IMPORT_HOST = new URL(IMPORT_LINK).hostname.replace(/^www\./, "");

type MobileTab = "plan" | "shopping" | "recipes";
type DemoScreen =
  | { kind: "add-meal"; dayIndex: number; mealType: MealType }
  | { kind: "recipe"; recipeId: string; servings?: number }
  | { kind: "create" }
  | { kind: "importing" };

const MOBILE_TABS: { value: MobileTab; label: string; Icon: typeof CalendarDays }[] = [
  { value: "plan", label: "Planer", Icon: CalendarDays },
  { value: "shopping", label: "Einkauf", Icon: ShoppingCart },
  { value: "recipes", label: "Rezepte", Icon: BookOpen },
];

const formatNumber = (value: number) => Math.round(value).toLocaleString("de-DE");

const notInDemo = () => toast("Das geht in der echten App – hier ist nur die Demo.");

type DemoData = {
  todayIndex: number;
  weekDates: number[];
  meals: DemoMeal[];
  recipes: Recipe[];
  recipesById: Map<string, Recipe>;
  tagsById: Record<string, string[]>;
  addMeal: (dayIndex: number, mealType: MealType, recipeId: string, servings: number) => void;
  removeMeal: (mealId: string) => void;
  addImportedRecipe: () => void;
};

// Holds the sample plan. On large screens a desktop and a phone view share it, so a
// meal planned on one shows up on the other; each keeps its own screens and tabs.
export function LandingDemo() {
  // The app's own desktop layout starts at 1024px; next to a phone it needs more room.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const hasRoomForBoth = useMediaQuery("(min-width: 1280px)");
  // Dates depend on the visitor's clock, so the planner fills in after mounting.
  const [todayIndex, setTodayIndex] = useState<number | null>(null);
  const [weekDates, setWeekDates] = useState<number[]>([]);
  const [meals, setMeals] = useState<DemoMeal[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>(DEMO_RECIPES);
  const [tagsById, setTagsById] = useState<Record<string, string[]>>(DEMO_TAGS_BY_ID);
  const nextMealId = useRef(100);

  useEffect(() => {
    const today = (new Date().getDay() + 6) % 7;
    const monday = new Date();
    monday.setDate(monday.getDate() - today);
    setWeekDates(
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        return date.getDate();
      }),
    );
    setTodayIndex(today);
    setMeals(initialDemoMeals(today));
  }, []);

  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);

  if (todayIndex === null) {
    return (
      <div className={cn(FRAME_CLASS, "p-3 sm:p-4")}>
        <PlannerSkeleton />
      </div>
    );
  }

  const data: DemoData = {
    todayIndex,
    weekDates,
    meals,
    recipes,
    recipesById,
    tagsById,
    addMeal: (dayIndex, mealType, recipeId, servings) =>
      setMeals((current) => [
        // Fixed slots hold one meal, like in the app; extras can hold any number.
        ...current.filter(
          (meal) => mealType === "extra" || meal.day_of_week !== dayIndex || meal.meal_type !== mealType,
        ),
        {
          id: `demo-${nextMealId.current++}`,
          meal_plan_id: "demo",
          recipe_id: recipeId,
          day_of_week: dayIndex,
          meal_type: mealType,
          serving_size: servings,
          created_at: new Date().toISOString(),
        },
      ]),
    removeMeal: (mealId) => setMeals((current) => current.filter((meal) => meal.id !== mealId)),
    addImportedRecipe: () => {
      setRecipes((current) =>
        current.some((recipe) => recipe.id === IMPORTED_RECIPE_ID) ? current : [IMPORTED_RECIPE, ...current],
      );
      setTagsById((current) => ({ ...current, [IMPORTED_RECIPE_ID]: IMPORTED_TAGS }));
    },
  };

  if (!isDesktop) return <DemoDevice data={data} layout="phone" />;
  if (!hasRoomForBoth) return <DemoDevice data={data} layout="desktop" />;

  return (
    <div className="flex items-start gap-8">
      <div className="min-w-0 flex-1">
        <DemoDevice data={data} layout="desktop" />
      </div>
      <div className="mt-14 w-[360px] shrink-0 rounded-[48px] bg-brand-ink p-2.5 shadow-[0_40px_70px_-30px_rgba(28,43,34,0.5)]">
        <DemoDevice data={data} layout="phone" framed />
      </div>
    </div>
  );
}

const FRAME_CLASS =
  "h-[680px] overflow-hidden rounded-[28px] bg-brand-app-bg shadow-[0_30px_60px_-30px_rgba(28,43,34,0.3)] ring-1 ring-brand-card-border lg:h-[760px]";

// One device: the desktop layout (week day + side panel) or the phone layout (tabs).
function DemoDevice({ data, layout, framed = false }: { data: DemoData; layout: "desktop" | "phone"; framed?: boolean }) {
  const { todayIndex, weekDates, meals, recipes, recipesById, tagsById } = data;
  const isDesktop = layout === "desktop";
  const [selectedDay, setSelectedDay] = useState(todayIndex);
  const [mobileTab, setMobileTab] = useState<MobileTab>("plan");
  const [panelTab, setPanelTab] = useState<"mine" | "discover" | "shopping">("shopping");
  const [screen, setScreen] = useState<DemoScreen | null>(null);
  const [importStep, setImportStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const importTimers = useRef<number[]>([]);

  useEffect(() => () => importTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const shoppingItems = useMemo(() => generateShoppingListFromPlannedMeals(meals, recipes), [meals, recipes]);

  const showScreen = useCallback((next: DemoScreen | null) => {
    setScreen(next);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const handleOpenScreen = useCallback(
    (next: Screen) => {
      if (next.kind === "add-meal") showScreen({ kind: "add-meal", dayIndex: next.dayIndex, mealType: next.mealType });
      else if (next.kind === "recipe-preview") showScreen({ kind: "recipe", recipeId: next.recipe.id, servings: next.servings });
      else if (next.kind === "recipe-create") showScreen({ kind: "create" });
      else notInDemo();
    },
    [showScreen],
  );

  const planMeal = (dayIndex: number, mealType: MealType, recipeId: string, servings: number) => {
    data.addMeal(dayIndex, mealType, recipeId, servings);
    setSelectedDay(dayIndex);
    setMobileTab("plan");
    showScreen(null);
  };

  const startImport = () => {
    importTimers.current.forEach((timer) => window.clearTimeout(timer));
    setImportStep(0);
    showScreen({ kind: "importing" });
    importTimers.current = [1, 2, 3, 4].map((step) =>
      window.setTimeout(() => setImportStep(step), step * IMPORT_STEP_MS),
    );
    importTimers.current.push(
      window.setTimeout(() => {
        data.addImportedRecipe();
        showScreen({ kind: "recipe", recipeId: IMPORTED_RECIPE_ID });
      }, 5 * IMPORT_STEP_MS),
    );
  };

  const cancelImport = () => {
    importTimers.current.forEach((timer) => window.clearTimeout(timer));
    showScreen({ kind: "create" });
  };

  const renderScreen = (current: DemoScreen) => {
    switch (current.kind) {
      case "add-meal":
        return (
          <AddMealDemoScreen
            key={`${current.dayIndex}-${current.mealType}`}
            dayIndex={current.dayIndex}
            mealType={current.mealType}
            recipes={recipes}
            tagsById={tagsById}
            plannedForDay={meals.filter((meal) => meal.day_of_week === current.dayIndex)}
            recipesById={recipesById}
            onBack={() => showScreen(null)}
            onAdd={(recipeId, servings) => planMeal(current.dayIndex, current.mealType, recipeId, servings)}
          />
        );
      case "recipe": {
        const recipe = recipesById.get(current.recipeId);
        if (!recipe) return null;
        return (
          <RecipeDemoScreen
            key={recipe.id}
            recipe={recipe}
            tags={tagsById[recipe.id] ?? []}
            isNew={recipe.id === IMPORTED_RECIPE_ID}
            initialServings={current.servings}
            selectedDay={selectedDay}
            onBack={() => showScreen(null)}
            onPlan={(dayIndex, mealType, servings) => planMeal(dayIndex, mealType, recipe.id, servings)}
          />
        );
      }
      case "create":
        return <CreateRecipeDemoScreen onBack={() => showScreen(null)} onStart={startImport} />;
      case "importing": {
        const stages: RecipeStreamStage[] = ["reading", "reading", "ingredients", "steps", "nutrition"];
        const draft =
          importStep < 2
            ? null
            : importedDraft(importStep === 2 ? 2 : 5, importStep === 2 ? 0 : importStep === 3 ? 2 : 4, importStep >= 4);
        return (
          <RecipeAiProgress
            title="Wird erkannt …"
            extraSteps={[
              importStep === 0
                ? { label: `${IMPORT_HOST} wird gelesen`, status: "active" }
                : { label: `${IMPORT_HOST} gelesen`, status: "done" },
            ]}
            stage={stages[importStep]}
            draft={draft}
            isIdea={false}
            onCancel={cancelImport}
          />
        );
      }
    }
  };

  const dayView = (
    <div className="mx-auto max-w-xl space-y-2.5">
      <div role="tablist" aria-label="Tag" className="grid grid-cols-7 gap-1">
        {SHORT_DAYS.map((day, index) => {
          const selected = index === selectedDay;
          const hasMeals = meals.some((meal) => meal.day_of_week === index);

          return (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`${DAYS[index]}${index === todayIndex ? ", heute" : ""}`}
              onClick={() => setSelectedDay(index)}
              className={cn(
                "flex h-[62px] touch-manipulation flex-col items-center justify-center gap-0.5 rounded-[14px] transition-all duration-150 active:scale-95",
                selected
                  ? "bg-brand-accent-dark text-white shadow-[0_4px_12px_rgba(47,122,82,0.3)]"
                  : index === todayIndex
                    ? "bg-white text-brand-ink ring-2 ring-brand-accent"
                    : "bg-white text-brand-ink ring-1 ring-brand-card-border",
              )}
            >
              <span className={cn("text-[11px] font-semibold", selected ? "text-white/80" : "text-brand-secondary")}>{day}</span>
              <span className="font-heading text-[17px] font-extrabold leading-none">{weekDates[index]}</span>
              <span
                className={cn("size-1.5 rounded-full", hasMeals ? (selected ? "bg-white" : "bg-brand-accent") : "bg-transparent")}
              />
            </button>
          );
        })}
      </div>

      <DayView
        dayIndex={selectedDay}
        isToday={selectedDay === todayIndex}
        meals={meals.filter((meal) => meal.day_of_week === selectedDay)}
        recipesById={recipesById}
        onRemove={data.removeMeal}
      />
    </div>
  );

  const recipeList = (
    <DemoRecipeList recipes={recipes} tagsById={tagsById} onNew={() => showScreen({ kind: "create" })} />
  );
  const recipeLibrary = (
    <div className="space-y-3">
      <SegmentedTabs
        label="Rezepte"
        value="mine"
        onChange={(value) => value === "discover" && notInDemo()}
        options={[
          { value: "mine", label: `Meine · ${recipes.length}` },
          { value: "discover", label: "Entdecken" },
        ]}
      />
      {recipeList}
    </div>
  );
  const shoppingList = (
    <ShoppingList items={shoppingItems} pantryStaples={DEMO_PANTRY_STAPLES} persist={false} alwaysCard={!isDesktop} />
  );

  return (
    <div
      className={
        framed ? "h-[740px] overflow-hidden rounded-[38px] bg-brand-app-bg [transform:translateZ(0)]" : FRAME_CLASS
      }
    >
      <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain [scrollbar-width:none]">
        <StaticScreenStackProvider onOpenScreen={handleOpenScreen}>
          {screen ? (
            renderScreen(screen)
          ) : (
            <div className="flex min-h-full flex-col">
              <header className="sticky top-0 z-40 border-b border-brand-card-border bg-white/90 backdrop-blur-lg">
                <div className={cn("flex h-[60px] items-center justify-between gap-3 px-4", framed && "pt-2")}>
                  <p className="flex min-w-0 items-center gap-2 font-heading text-[22px] font-extrabold text-brand-ink">
                    {isDesktop ? (
                      <>
                        <span aria-hidden="true" className="text-[26px]">🥗</span>
                        Wochen-Essensplaner
                      </>
                    ) : mobileTab === "plan" ? (
                      <>
                        <span aria-hidden="true" className="text-[26px]">🥗</span>
                        WMP
                      </>
                    ) : (
                      <span>{mobileTab === "shopping" ? "Einkauf" : "Rezepte"}</span>
                    )}
                  </p>
                  <span className="rounded-full bg-brand-highlight px-2.5 py-1 text-xs font-bold text-brand-ink">Demo</span>
                </div>
              </header>

              <main className="flex-1 p-3 sm:p-4">
                {isDesktop ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-5">
                    <div className="min-w-0">{dayView}</div>
                    {/* Same panel as the app: one tab row, sticky, scrolls by itself. */}
                    <div className="sticky top-[76px] flex max-h-[668px] flex-col gap-3 self-start rounded-xl bg-white p-3 ring-1 ring-brand-card-border">
                      <SegmentedTabs
                        label="Seitenleiste"
                        value={panelTab}
                        onChange={(value) => (value === "discover" ? notInDemo() : setPanelTab(value))}
                        options={[
                          { value: "mine", label: `Meine · ${recipes.length}` },
                          { value: "discover", label: "Entdecken" },
                          { value: "shopping", label: "Einkauf" },
                        ]}
                      />
                      <div className="-mx-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-1">
                        {panelTab === "shopping" ? shoppingList : recipeList}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mobileTab === "plan" && dayView}
                    {mobileTab === "shopping" && shoppingList}
                    {mobileTab === "recipes" && recipeLibrary}
                  </div>
                )}
              </main>

              {!isDesktop && <DemoTabBar activeTab={mobileTab} onTabChange={setMobileTab} />}
            </div>
          )}
        </StaticScreenStackProvider>
      </div>
    </div>
  );
}

function PlannerSkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-2.5" aria-busy="true" aria-label="Lädt">
      <div className="grid grid-cols-7 gap-1">
        {SHORT_DAYS.map((day) => (
          <Skeleton key={day} className="h-[62px] rounded-[14px]" />
        ))}
      </div>
      <Skeleton className="h-[104px] rounded-[18px]" />
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-[86px] rounded-[18px]" />
      ))}
    </div>
  );
}

// Same structure as the planner's DayCard on phones: summary, the four fixed meals, extras.
function DayView({
  dayIndex,
  isToday,
  meals,
  recipesById,
  onRemove,
}: {
  dayIndex: number;
  isToday: boolean;
  meals: DemoMeal[];
  recipesById: Map<string, Recipe>;
  onRemove: (mealId: string) => void;
}) {
  const extraMeals = meals.filter((meal) => meal.meal_type === "extra");

  return (
    <div className="w-full space-y-2.5">
      <DaySummary
        title={DAYS[dayIndex]}
        isToday={isToday}
        totals={sumMealNutrition(meals, recipesById)}
        targets={DEMO_TARGETS}
      />
      {FIXED_MEAL_TYPES.map((mealType) => {
        const meal = meals.find((candidate) => candidate.meal_type === mealType);
        const recipe = meal ? recipesById.get(meal.recipe_id) : undefined;

        return meal && recipe ? (
          <MealSlotCard
            key={mealType}
            recipe={recipe}
            mealType={mealType}
            servingSize={meal.serving_size}
            nutritionTargets={DEMO_TARGETS}
            onRemove={() => onRemove(meal.id)}
          />
        ) : (
          <AddMealButton key={mealType} dayOfWeek={dayIndex} mealType={mealType} />
        );
      })}
      <div className="space-y-2.5">
        {extraMeals.map((meal) => {
          const recipe = recipesById.get(meal.recipe_id);
          if (!recipe) return null;
          return (
            <MealSlotCard
              key={meal.id}
              recipe={recipe}
              mealType="extra"
              servingSize={meal.serving_size}
              nutritionTargets={DEMO_TARGETS}
              onRemove={() => onRemove(meal.id)}
            />
          );
        })}
        <AddMealButton dayOfWeek={dayIndex} mealType="extra" label="Extras" />
      </div>
    </div>
  );
}

// The app's floating tab pill, kept inside the demo frame instead of fixed to the window.
const TAB_ACTIVE_WIDTH = 108;
const TAB_INACTIVE_WIDTH = 48;
const TAB_GAP = 4;
const TAB_PADDING = 6;
const TAB_EASE = "duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

function DemoTabBar({ activeTab, onTabChange }: { activeTab: MobileTab; onTabChange: (tab: MobileTab) => void }) {
  const activeIndex = MOBILE_TABS.findIndex((tab) => tab.value === activeTab);

  return (
    <nav aria-label="Bereiche der Demo" className="pointer-events-none sticky bottom-4 z-40 mt-2 flex justify-center pb-1">
      <div
        className="pointer-events-auto relative flex h-14 items-center rounded-full bg-white/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6),0_0_0_1px_rgba(28,43,34,0.05),0_8px_24px_rgba(28,43,34,0.14)] backdrop-blur-xl backdrop-saturate-150"
        style={{ gap: TAB_GAP, paddingInline: TAB_PADDING }}
      >
        <span
          aria-hidden="true"
          className={cn("absolute left-0 top-1.5 h-11 rounded-full bg-brand-accent-dark transition-transform", TAB_EASE)}
          style={{
            width: TAB_ACTIVE_WIDTH,
            transform: `translateX(${TAB_PADDING + activeIndex * (TAB_INACTIVE_WIDTH + TAB_GAP)}px)`,
          }}
        />
        {MOBILE_TABS.map(({ value, label, Icon }) => {
          const isActive = value === activeTab;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onTabChange(value)}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              style={{ width: isActive ? TAB_ACTIVE_WIDTH : TAB_INACTIVE_WIDTH }}
              className={cn(
                "relative flex h-11 shrink-0 touch-manipulation items-center overflow-hidden rounded-full pl-[13px] text-[13px] font-bold transition-[width,color]",
                TAB_EASE,
                isActive ? "text-white" : "text-[#7d8a83] active:bg-black/5",
              )}
            >
              <Icon className="size-[22px] shrink-0" strokeWidth={isActive ? 2.2 : 2} />
              <span
                className={cn(
                  "ml-1.5 whitespace-nowrap transition-opacity motion-reduce:transition-none",
                  isActive ? "opacity-100 delay-150 duration-200" : "opacity-0 duration-100",
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function DemoRecipeList({
  recipes,
  tagsById,
  onNew,
}: {
  recipes: Recipe[];
  tagsById: Record<string, string[]>;
  onNew: () => void;
}) {
  return (
    <RecipeList
      recipes={recipes}
      recipeTagsById={tagsById}
      loading={false}
      showNutrition={DEMO_TARGETS.show_nutrition}
      disableDrag
      toolbarActions={
        <button
          type="button"
          onClick={onNew}
          className="flex h-11 shrink-0 touch-manipulation items-center gap-1 rounded-xl bg-brand-accent px-3.5 text-sm font-bold text-white transition-transform active:scale-[0.97] active:bg-brand-accent-dark"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Neu
        </button>
      }
    />
  );
}

// Mirrors the app's "add meal" screen: recipes that fit the rest of the day come first.
function AddMealDemoScreen({
  dayIndex,
  mealType,
  recipes,
  tagsById,
  plannedForDay,
  recipesById,
  onBack,
  onAdd,
}: {
  dayIndex: number;
  mealType: MealType;
  recipes: Recipe[];
  tagsById: Record<string, string[]>;
  plannedForDay: DemoMeal[];
  recipesById: Map<string, Recipe>;
  onBack: () => void;
  onAdd: (recipeId: string, servings: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [servings, setServings] = useState(1);
  const [search, setSearch] = useState("");
  const [onlyFits, setOnlyFits] = useState(false);

  const planned = sumMealNutrition(plannedForDay, recipesById);
  const remaining = {
    calories: DEMO_TARGETS.calories_target - planned.calories,
    protein: DEMO_TARGETS.protein_target - planned.protein,
  };

  const fits = (recipe: Recipe) =>
    remaining.calories > 0 &&
    recipe.calories != null &&
    recipe.calories * servings <= remaining.calories + 50 &&
    recipe.calories * servings >= Math.min(remaining.calories * 0.4, 400);

  const mealLabel = MEAL_TYPE_LABELS[mealType].toLowerCase();
  const query = search.trim().toLowerCase();
  const visibleRecipes = recipes
    .filter((recipe) => {
      if (query && ![recipe.name, recipe.ingredients].join(" ").toLowerCase().includes(query)) return false;
      return !onlyFits || fits(recipe);
    })
    .sort((a, b) => {
      const score = (recipe: Recipe) =>
        (fits(recipe) ? 2 : 0) +
        ((tagsById[recipe.id] ?? []).some((tag) => tag.toLowerCase().startsWith(mealLabel)) ? 1 : 0);
      return score(b) - score(a);
    });

  const subtitle =
    remaining.calories > 0
      ? `Noch ${formatNumber(remaining.calories)} kcal${remaining.protein > 0 ? ` und ${formatNumber(remaining.protein)} g Protein` : ""} frei`
      : "Tagesziel schon erreicht";

  return (
    <SubPage
      title={`${MEAL_TYPE_LABELS[mealType]} · ${DAYS[dayIndex]}`}
      subtitle={subtitle}
      onBack={onBack}
      headerExtra={
        <div className="space-y-2.5">
          <label className="flex h-11 items-center gap-2 rounded-xl bg-brand-chip-neutral px-3">
            <Search className="size-4 text-brand-secondary" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rezept suchen"
              aria-label="Rezept suchen"
              type="search"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-brand-ink outline-none placeholder:text-brand-muted"
            />
          </label>
          <div className="flex gap-1.5">
            {(
              [
                [false, "Alle"],
                [true, "Passt heute"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setOnlyFits(value)}
                aria-pressed={onlyFits === value}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold transition-all active:scale-95",
                  onlyFits === value ? "bg-brand-accent-dark font-bold text-white" : "bg-brand-chip-neutral text-brand-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      }
      footer={
        <div className="flex items-center gap-2.5">
          <Stepper value={servings} onChange={setServings} min={0.5} max={12} step={0.5} label="Portionen" />
          <Button
            onClick={() => selectedId && onAdd(selectedId, servings)}
            disabled={!selectedId}
            className="h-[52px] flex-1 rounded-[14px] text-base font-bold"
          >
            {servings === 1 ? "Hinzufügen" : `${servings.toLocaleString("de-DE")} Portionen hinzufügen`}
          </Button>
        </div>
      }
    >
      {visibleRecipes.length === 0 ? (
        <p className="py-10 text-center text-sm text-brand-secondary">Nichts gefunden</p>
      ) : (
        <ul className="-mt-2">
          {visibleRecipes.map((recipe) => {
            const selected = recipe.id === selectedId;
            const facts = [
              recipe.calories != null && `${formatNumber(recipe.calories * servings)} kcal`,
              recipe.protein != null && `${formatNumber(recipe.protein * servings)} g Protein`,
              recipe.prep_time,
            ].filter(Boolean);

            return (
              <li key={recipe.id} className="border-b border-brand-divider last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(selected ? null : recipe.id)}
                  aria-pressed={selected}
                  aria-label={`${recipe.name} auswählen`}
                  className="flex w-full touch-manipulation items-center gap-3 py-2.5 text-left transition-transform active:scale-[0.98]"
                >
                  <span className="flex size-[60px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-chip-neutral">
                    <UtensilsCrossed className="size-6 text-brand-muted" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-bold text-brand-ink">{recipe.name}</span>
                    <span className="truncate text-[13px] text-brand-secondary">{facts.join(" · ")}</span>
                    {fits(recipe) && (
                      <span className="self-start rounded-md bg-brand-accent-bg px-1.5 py-0.5 text-[11px] font-bold text-brand-accent-dark">
                        Passt gut
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full transition-all duration-150",
                      selected ? "bg-brand-accent-dark text-white" : "border-2 border-brand-disabled",
                    )}
                  >
                    {selected && <Check className="size-4 animate-pop-in" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SubPage>
  );
}

// The app's recipe screen (same body), with "Einplanen" picking a day and meal inline.
function RecipeDemoScreen({
  recipe,
  tags,
  isNew,
  initialServings,
  selectedDay,
  onBack,
  onPlan,
}: {
  recipe: Recipe;
  tags: string[];
  isNew: boolean;
  initialServings?: number;
  selectedDay: number;
  onBack: () => void;
  onPlan: (dayIndex: number, mealType: MealType, servings: number) => void;
}) {
  const [servings, setServings] = useState(initialServings ?? recipe.serving_size);
  const [planning, setPlanning] = useState(false);
  const [planDay, setPlanDay] = useState(selectedDay);
  const [planMeal, setPlanMeal] = useState<MealType>("dinner");

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <div className="flex-1">
        <RecipeBody
          recipe={recipe}
          tags={tags}
          servings={servings}
          onServingsChange={setServings}
          attribution={
            isNew ? (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-highlight px-2.5 py-1 text-xs font-bold text-brand-ink">
                <Sparkles className="size-3.5" />
                Gerade per KI importiert
              </p>
            ) : undefined
          }
          heroActions={
            <HeroButton label="Zurück" onClick={onBack}>
              <ChevronLeft className="size-6" />
            </HeroButton>
          }
        />
      </div>

      <footer className="sticky bottom-0 z-30 border-t border-brand-card-border bg-white shadow-[0_-6px_16px_rgba(28,43,34,0.06)]">
        {planning && (
          <div className="mx-auto w-full max-w-2xl animate-fade-up space-y-2.5 px-4 pt-3">
            <div className="grid grid-cols-7 gap-1">
              {SHORT_DAYS.map((day, index) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={planDay === index}
                  onClick={() => setPlanDay(index)}
                  className={cn(
                    "h-10 rounded-xl text-[13px] font-bold transition-all active:scale-95",
                    planDay === index ? "bg-brand-accent-dark text-white" : "bg-brand-chip-neutral text-brand-ink",
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {FIXED_MEAL_TYPES.map((mealType) => (
                <button
                  key={mealType}
                  type="button"
                  aria-pressed={planMeal === mealType}
                  onClick={() => setPlanMeal(mealType)}
                  className={cn(
                    "h-10 rounded-xl text-[13px] font-bold transition-all active:scale-95",
                    planMeal === mealType ? "bg-brand-accent-dark text-white" : "bg-brand-chip-neutral text-brand-ink",
                  )}
                >
                  {MEAL_TYPE_LABELS[mealType]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mx-auto flex w-full max-w-2xl gap-2.5 px-4 pb-3 pt-2.5">
          {planning ? (
            <>
              <button
                type="button"
                onClick={() => setPlanning(false)}
                className="flex h-[52px] items-center whitespace-nowrap rounded-[14px] border border-[#d9e6dc] bg-white px-4 text-[15px] font-bold text-brand-ink transition-transform active:scale-[0.97]"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => onPlan(planDay, planMeal, servings)}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-brand-accent-dark text-base font-bold text-white transition-transform active:scale-[0.97]"
              >
                <CalendarPlus className="size-[18px]" />
                {SHORT_DAYS[planDay]} · {MEAL_TYPE_LABELS[planMeal]} einplanen
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPlanning(true)}
                className="flex h-[52px] items-center gap-1.5 whitespace-nowrap rounded-[14px] border border-[#d9e6dc] bg-white px-4 text-[15px] font-bold text-brand-accent-dark transition-transform active:scale-[0.97] active:bg-brand-accent-bg"
              >
                <CalendarPlus className="size-[18px]" />
                Einplanen
              </button>
              <button
                type="button"
                onClick={notInDemo}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-brand-accent-dark text-base font-bold text-white transition-transform active:scale-[0.97]"
              >
                <ChefHat className="size-[18px]" />
                Kochen starten
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

const CREATE_MODES = [
  { value: "import", label: "Importieren", Icon: Download },
  { value: "idea", label: "Aus Idee", Icon: Lightbulb },
  { value: "manual", label: "Manuell", Icon: PencilLine },
] as const;

// The app's "Neues Rezept" screen with an example link already pasted in.
function CreateRecipeDemoScreen({ onBack, onStart }: { onBack: () => void; onStart: () => void }) {
  return (
    <SubPage
      title="Neues Rezept"
      onBack={onBack}
      footer={
        <Button className="h-12 w-full rounded-xl text-base font-bold" onClick={onStart}>
          <Sparkles className="size-5" />
          Rezept erkennen
        </Button>
      }
    >
      <div role="tablist" aria-label="Art" className="grid grid-cols-3 gap-1 rounded-2xl bg-brand-chip-neutral p-1">
        {CREATE_MODES.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={value === "import"}
            onClick={value === "import" ? undefined : notInDemo}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]",
              value === "import" ? "bg-white text-brand-accent-dark shadow-sm" : "text-brand-secondary",
            )}
          >
            {value === "import" && <Icon className="size-4" />}
            {label}
          </button>
        ))}
      </div>

      <section className="space-y-3 rounded-2xl border-[1.5px] border-brand-accent bg-white p-3.5 shadow-[0_0_0_4px_#eaf3ec]">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-secondary">Alles hier rein</p>
        <p className="break-all text-[15px] leading-relaxed text-brand-ink">{IMPORT_LINK}</p>
        <div className="flex items-center gap-2.5 rounded-xl border border-brand-track bg-brand-stat-bg p-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent-bg text-brand-accent-dark">
            <Link2 className="size-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-brand-ink">{IMPORT_HOST}</p>
            <p className="truncate text-xs text-brand-secondary">{IMPORT_LINK}</p>
          </div>
          <span className="flex size-8 items-center justify-center text-brand-muted" aria-hidden="true">
            <X className="size-4" />
          </span>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-brand-divider pt-3">
          {(
            [
              [ClipboardPaste, "Einfügen"],
              [Plus, "Fotos"],
              [Camera, "Kamera"],
              [FileText, "PDF"],
            ] as const
          ).map(([Icon, label]) => (
            <button
              key={label}
              type="button"
              onClick={notInDemo}
              className="flex h-9 items-center gap-1.5 rounded-full border border-brand-input-border bg-white px-3 text-[13px] font-semibold text-brand-ink transition-all active:scale-95 active:bg-brand-accent-bg"
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-2.5 px-1">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-accent-dark" />
        <p className="text-[13px] leading-relaxed text-brand-secondary">
          Link, Text, Fotos oder PDF – die KI macht daraus <strong className="text-brand-ink">ein</strong> Rezept mit Zutaten,
          Schritten und Nährwerten.
        </p>
      </div>
    </SubPage>
  );
}
