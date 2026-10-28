"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquarePlus, WifiOff } from "lucide-react";
import { MealWeekView, useViewMode, ViewModeToggle } from "./meal-week-view";
import { RecipeLibrary, SegmentedTabs } from "./recipe-library";
import { RecipeEditor } from "./recipe-editor";
import { RecipeCreateScreen } from "./recipe-create-screen";
import { RecipeView } from "./recipe-view";
import { SharedRecipeScreen } from "./shared-recipe-screen";
import { ProfileScreen, profileInitial } from "./profile-screen";
import { CookingMode } from "./cooking-mode";
import { AddMealScreen } from "./add-meal-screen";
import { ShoppingList } from "./shopping-list";
import { MobileTabBar, type MobileTab } from "./mobile-tab-bar";
import { FeedbackPopover } from "./feedback-popover";
import { WhatsNewScreen } from "./whats-new-screen";
import { PantryStaplesScreen, usePantryStaples } from "./pantry-staples-settings";
import { ScreenStackProvider, useScreenStack, type Screen } from "./screen-stack";
import type { Recipe } from "@/types/database";
import {
  NutritionTargetsScreen,
  useNutritionTargets,
} from "./nutrition-target-settings";
import { generateShoppingListFromPlannedMeals } from "@/lib/shopping-list";
import { collectIngredientNames } from "@/lib/editable-recipe";
import { takeSharedContent } from "@/lib/share-target";
import { QueryProvider } from "@/lib/query-provider";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/context";
import { useMealPlanData, useProfileQuery } from "@/hooks/use-planner-data";
import { useDeleteRecipe } from "@/hooks/use-planner-mutations";
import { sumMealNutrition } from "./day-card";
import { useEntrance } from "@/hooks/use-entrance";

type DesktopRightPanelTab = "mine" | "discover" | "shopping";

export function MealPlannerMain() {
  return (
    <QueryProvider>
      <ScreenStackProvider>
        <MealPlanner />
      </ScreenStackProvider>
    </QueryProvider>
  );
}

function useIsOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

// day_of_week in this app is Monday=0..Sunday=6.
const getTodayDayIndex = () => (new Date().getDay() + 6) % 7;

function MealPlanner() {
  const { stack, openScreen, replaceScreen, closeScreen } = useScreenStack();
  const [nutritionTargets, setNutritionTargets] = useNutritionTargets();
  const [pantryStaples, setPantryStaples] = usePantryStaples();
  const [mobileTab, setMobileTab] = useState<MobileTab>("plan");
  const [viewMode, setViewMode] = useViewMode();
  const { user } = useAuth();
  const { data: profile } = useProfileQuery();
  const [desktopRightPanelTab, setDesktopRightPanelTab] =
    useState<DesktopRightPanelTab>("mine");
  const isOnline = useIsOnline();
  // Where feedback was opened from, or null while the feedback card is closed.
  const [feedbackContext, setFeedbackContext] = useState<string | null>(null);

  const mealPlanData = useMealPlanData();
  const deleteRecipe = useDeleteRecipe();

  const shoppingListItems = useMemo(
    () =>
      generateShoppingListFromPlannedMeals(
        mealPlanData.plannedMeals,
        mealPlanData.recipes,
      ),
    [mealPlanData.plannedMeals, mealPlanData.recipes],
  );

  const ingredientSuggestions = useMemo(
    () => collectIngredientNames(mealPlanData.recipes),
    [mealPlanData.recipes],
  );

  const existingTags = useMemo(
    () =>
      [...new Set(Object.values(mealPlanData.tagsById).flat())].sort((a, b) =>
        a.localeCompare(b, "de"),
      ),
    [mealPlanData.tagsById],
  );

  // What is left of today's targets, so "Aus Idee" can fit a recipe into the day.
  const targetHint = useMemo(() => {
    if (!nutritionTargets.show_nutrition) return null;
    const recipesById = new Map(mealPlanData.recipes.map((recipe) => [recipe.id, recipe]));
    const todayMeals = mealPlanData.plannedMeals.filter(
      (meal) => meal.day_of_week === getTodayDayIndex(),
    );
    const planned = sumMealNutrition(todayMeals, recipesById);
    const parts: string[] = [];

    if (nutritionTargets.calories_target_enabled) {
      const left = Math.round(nutritionTargets.calories_target - planned.calories);
      if (left < 150) return null;
      parts.push(`${left} kcal`);
    }

    if (nutritionTargets.protein_target_enabled) {
      const left = Math.round(nutritionTargets.protein_target - planned.protein);
      if (left > 0) parts.push(`${left} g Protein`);
    }

    return parts.length > 0 ? parts.join(" · ") : null;
  }, [mealPlanData.recipes, mealPlanData.plannedMeals, nutritionTargets]);

  // Content shared into the app from another app (see public/sw.js).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("shared")) return;

    window.history.replaceState(window.history.state, "", window.location.pathname);

    void takeSharedContent().then((sharedContent) => {
      const fallback = {
        url: params.get("url") ?? "",
        text: [params.get("title"), params.get("text")].filter(Boolean).join("\n"),
        files: [],
      };
      const content = sharedContent ?? (fallback.url || fallback.text ? fallback : null);

      if (content) openScreen({ kind: "recipe-create", sharedContent: content });
    });
  }, [openScreen]);

  const handleRecipeDelete = (recipe: Recipe) => {
    closeScreen();
    deleteRecipe(recipe);
  };

  // Stored with feedback to help reproduce bugs.
  const currentContext = () =>
    window.matchMedia("(min-width: 1024px)").matches
      ? `Desktop · ${desktopRightPanelTab}`
      : `Mobil · ${mobileTab}`;

  const toggleFeedback = (context = currentContext()) =>
    setFeedbackContext((open) => (open === null ? context : null));

  const avatar = (
    <button
      type="button"
      onClick={() => openScreen({ kind: "profile" })}
      aria-label="Profil"
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-accent-bg font-heading text-[15px] font-extrabold text-brand-accent-dark transition-transform active:scale-90"
    >
      {profileInitial(profile?.displayName, user?.email)}
    </button>
  );

  const renderScreen = (screen: Screen) => {
    switch (screen.kind) {
      case "recipe-form":
        return (
          <RecipeEditor
            recipe={screen.recipe}
            recipeTags={screen.recipe ? mealPlanData.tagsById[screen.recipe.id] : undefined}
            draft={screen.draft}
            draftImage={screen.draftImage}
            ingredientSuggestions={ingredientSuggestions}
            existingTags={existingTags}
            onBack={closeScreen}
            onSaved={closeScreen}
          />
        );
      case "recipe-create":
        return (
          <RecipeCreateScreen
            sharedContent={screen.sharedContent}
            targetHint={targetHint}
            onBack={closeScreen}
            onManual={() => replaceScreen({ kind: "recipe-form" })}
            onDraftReady={(draft, cover) =>
              replaceScreen({ kind: "recipe-form", draft, draftImage: cover })
            }
          />
        );
      case "recipe-preview":
        return (
          <RecipeView
            recipe={screen.recipe}
            tags={mealPlanData.tagsById[screen.recipe.id] ?? []}
            initialServings={screen.servings}
            onBack={closeScreen}
            // Replace so saving the form returns to the list, not a stale preview.
            onEdit={(recipe) => replaceScreen({ kind: "recipe-form", recipe })}
            onDelete={handleRecipeDelete}
            onCook={(recipe, servings) => openScreen({ kind: "cooking-mode", recipe, servings })}
          />
        );
      case "cooking-mode":
        return <CookingMode recipe={screen.recipe} servings={screen.servings} onBack={closeScreen} />;
      case "shared-recipe":
        return <SharedRecipeScreen recipe={screen.recipe} onBack={closeScreen} />;
      case "profile":
        return (
          <ProfileScreen
            targets={nutritionTargets}
            pantryStaples={pantryStaples}
            onFeedback={() => toggleFeedback("Profil")}
            onBack={closeScreen}
          />
        );
      case "add-meal":
        return (
          <AddMealScreen
            dayOfWeek={screen.dayIndex}
            mealType={screen.mealType}
            nutritionTargets={nutritionTargets}
            onBack={closeScreen}
            onMealAdded={closeScreen}
          />
        );
      case "nutrition-targets":
        return (
          <NutritionTargetsScreen
            targets={nutritionTargets}
            onBack={closeScreen}
            onChange={setNutritionTargets}
          />
        );
      case "whats-new":
        return <WhatsNewScreen onBack={closeScreen} />;
      case "pantry-staples":
        return (
          <PantryStaplesScreen
            staples={pantryStaples}
            onBack={closeScreen}
            onChange={setPantryStaples}
          />
        );
    }
  };

  return (
    <>
      {/* The planner stays mounted underneath open screens so it keeps its state. */}
      <div
        className={cn(
          "min-h-screen bg-brand-app-bg pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0",
          stack.length > 0 && "hidden",
        )}
      >
        <header className="sticky top-0 z-40 border-b border-brand-card-border bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
          <div className="flex h-[60px] items-center justify-between gap-3 px-4">
            <h1 className="flex min-w-0 items-center gap-2 font-heading text-[22px] font-extrabold text-brand-ink">
              {mobileTab === "plan" ? (
                <>
                  <span aria-hidden="true" className="text-[26px]">🥗</span>
                  <span className="sm:hidden">WMP</span>
                  <span className="hidden sm:inline">Wochen-Essensplaner</span>
                </>
              ) : (
                <>
                  <span className="lg:hidden">{mobileTab === "shopping" ? "Einkauf" : "Rezepte"}</span>
                  <span className="hidden items-center gap-2 lg:flex">
                    <span aria-hidden="true" className="text-[26px]">🥗</span>
                    Wochen-Essensplaner
                  </span>
                </>
              )}
            </h1>
            <div className="flex items-center gap-2">
              <div className={cn(mobileTab !== "plan" && "hidden lg:block")}>
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              </div>
              <button
                type="button"
                onClick={() => toggleFeedback()}
                data-feedback-trigger
                aria-label="Feedback senden"
                aria-expanded={feedbackContext !== null}
                className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-brand-chip-neutral text-brand-secondary transition-transform active:scale-90 lg:flex"
              >
                <MessageSquarePlus className="size-[18px]" />
              </button>
              {avatar}
            </div>
          </div>
        </header>

        {!isOnline && (
          <div
            role="status"
            className="mx-4 mt-3 flex items-center gap-2 rounded-full bg-[#fdf0d5] px-4 py-2 text-[13px] font-semibold text-[#7a4f0e]"
          >
            <WifiOff className="size-4 shrink-0" />
            Offline · Änderungen werden gespeichert, sobald du wieder online bist
          </div>
        )}

        <main className="p-3 sm:p-4">
          {/* Desktop layout: week view next to the recipe-library-or-shopping-list panel */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-6">
              <div className="min-w-0 space-y-4">
                <MealWeekView
                  recipes={mealPlanData.recipes}
                  plannedMeals={mealPlanData.plannedMeals}
                  loading={mealPlanData.loading}
                  nutritionTargets={nutritionTargets}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
              </div>
              {/* Stays in view next to the week and scrolls by itself, so a long
                  recipe list doesn't stretch the page (iPad). */}
              <div className="sticky top-[calc(76px+env(safe-area-inset-top))] flex max-h-[calc(100dvh-92px-env(safe-area-inset-top))] flex-col gap-3 self-start rounded-xl bg-white p-3 ring-1 ring-brand-card-border">
                {/* One row for all three, instead of "Rezepte | Einkaufsliste"
                    with "Meine | Entdecken" stacked underneath. */}
                <SegmentedTabs
                  label="Seitenleiste"
                  value={desktopRightPanelTab}
                  onChange={setDesktopRightPanelTab}
                  options={[
                    {
                      value: "mine",
                      label: mealPlanData.loading ? "Meine" : `Meine · ${mealPlanData.recipes.length}`,
                    },
                    { value: "discover", label: "Entdecken" },
                    { value: "shopping", label: "Einkauf" },
                  ]}
                />

                <div className="-mx-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-1">
                  {desktopRightPanelTab === "shopping" ? (
                    <ShoppingList items={shoppingListItems} pantryStaples={pantryStaples} />
                  ) : (
                    <RecipeLibrary tab={desktopRightPanelTab} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile layout: single active tab, switched via the bottom nav */}
          <Entrance key={mobileTab} className="space-y-4 lg:hidden" animation="animate-rise">
            {mobileTab === "plan" && (
              <MealWeekView
                recipes={mealPlanData.recipes}
                plannedMeals={mealPlanData.plannedMeals}
                loading={mealPlanData.loading}
                nutritionTargets={nutritionTargets}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />
            )}
            {mobileTab === "shopping" && (
              <ShoppingList items={shoppingListItems} pantryStaples={pantryStaples} />
            )}
            {mobileTab === "recipes" && <RecipeLibrary />}
          </Entrance>
        </main>

        <MobileTabBar
          activeTab={mobileTab}
          onTabChange={setMobileTab}
          feedbackOpen={feedbackContext !== null}
          onFeedback={() => toggleFeedback()}
        />
      </div>

      {stack.map((entry, index) => (
        <Entrance
          key={entry.key}
          className={cn(index < stack.length - 1 && "hidden")}
          animation="animate-screen-in"
        >
          {renderScreen(entry.screen)}
        </Entrance>
      ))}

      {feedbackContext !== null && (
        <FeedbackPopover context={feedbackContext} onClose={() => setFeedbackContext(null)} />
      )}
    </>
  );
}

function Entrance({
  animation,
  className,
  children,
}: {
  animation: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { entering, onAnimationEnd } = useEntrance();

  return (
    <div className={cn(entering && animation, className)} onAnimationEnd={onAnimationEnd}>
      {children}
    </div>
  );
}
