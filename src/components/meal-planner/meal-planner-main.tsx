"use client";

import { useMemo, useState } from "react";
import { ChefHat, Settings2 } from "lucide-react";
import { MealWeekView } from "./meal-week-view";
import { RecipeLibrary } from "./recipe-library";
import { RecipeForm } from "./recipe-form";
import { RecipeAiImport } from "./recipe-ai-import";
import { RecipePreview } from "./recipe-list";
import { CookingMode } from "./cooking-mode";
import { AddMealScreen } from "./add-meal-screen";
import { ShoppingList } from "./shopping-list";
import { MobileTabBar, type MobileTab } from "./mobile-tab-bar";
import { SubPage } from "./sub-page";
import { ScreenStackProvider, useScreenStack, type Screen } from "./screen-stack";
import {
  NutritionTargetsScreen,
  useNutritionTargets,
} from "./nutrition-target-settings";
import { generateShoppingListFromPlannedMeals } from "@/lib/shopping-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useMealPlanData } from "@/hooks/use-meal-plan-data";

type DesktopRightPanelTab = "recipes" | "shopping";

export function MealPlannerMain() {
  return (
    <ScreenStackProvider>
      <MealPlanner />
    </ScreenStackProvider>
  );
}

function MealPlanner() {
  const { stack, openScreen, replaceScreen, closeScreen } = useScreenStack();
  const [recipeLibraryRefreshKey, setRecipeLibraryRefreshKey] = useState(0);
  const [nutritionTargets, setNutritionTargets] = useNutritionTargets();
  const [mobileTab, setMobileTab] = useState<MobileTab>("plan");
  const [desktopRightPanelTab, setDesktopRightPanelTab] =
    useState<DesktopRightPanelTab>("recipes");

  const mealPlanData = useMealPlanData();

  const shoppingListItems = useMemo(
    () =>
      generateShoppingListFromPlannedMeals(
        mealPlanData.plannedMeals,
        mealPlanData.recipes,
      ),
    [mealPlanData.plannedMeals, mealPlanData.recipes],
  );

  const handleRecipeSaved = () => {
    closeScreen();
    setRecipeLibraryRefreshKey((prev) => prev + 1);
    mealPlanData.reload();
  };

  const renderScreen = (screen: Screen) => {
    switch (screen.kind) {
      case "recipe-form":
        return (
          <RecipeForm
            recipe={screen.recipe}
            draft={screen.draft}
            onBack={closeScreen}
            onRecipeSaved={handleRecipeSaved}
          />
        );
      case "recipe-ai-import":
        return (
          <RecipeAiImport
            onBack={closeScreen}
            onDraftReady={(draft) => replaceScreen({ kind: "recipe-form", draft })}
          />
        );
      case "recipe-preview":
        return (
          <SubPage
            title="Rezept"
            onBack={closeScreen}
            footer={
              <Button
                className="h-12 w-full"
                onClick={() => openScreen({ kind: "cooking-mode", recipe: screen.recipe })}
              >
                <ChefHat className="size-5" />
                Kochen starten
              </Button>
            }
          >
            <RecipePreview recipe={screen.recipe} tags={screen.tags} />
          </SubPage>
        );
      case "cooking-mode":
        return <CookingMode recipe={screen.recipe} onBack={closeScreen} />;
      case "add-meal":
        return (
          <AddMealScreen
            dayOfWeek={screen.dayIndex}
            mealType={screen.mealType}
            onBack={closeScreen}
            onMealAdded={() => {
              closeScreen();
              mealPlanData.reload();
            }}
          />
        );
      case "nutrition-targets":
        return (
          <NutritionTargetsScreen
            targets={nutritionTargets}
            onBack={closeScreen}
            onSaved={(targets) => {
              setNutritionTargets(targets);
              closeScreen();
            }}
          />
        );
    }
  };

  return (
    <>
      {/* The planner stays mounted underneath open screens so it keeps its state. */}
      <div
        className={cn(
          "min-h-screen bg-brand-app-bg pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0",
          stack.length > 0 && "hidden",
        )}
      >
        <header className="sticky top-0 z-40 border-b border-brand-card-border bg-white">
          <div className="flex items-center justify-between px-4 py-4">
            <h1 className="font-heading text-2xl font-extrabold text-brand-ink">
              <span className="sm:hidden">WMP</span>
              <span className="hidden sm:inline">Wochen-Essensplaner</span>
            </h1>
            <Button
              variant="outline"
              size="sm"
              className="text-brand-accent-dark"
              onClick={() => openScreen({ kind: "nutrition-targets" })}
            >
              <Settings2 className="mr-1.5 h-4 w-4" />
              Ziele
            </Button>
          </div>
        </header>

        <main className="p-4">
          {/* Desktop layout: week view next to the recipe-library-or-shopping-list panel */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-6">
              <div className="min-w-0 space-y-4">
                <MealWeekView
                  recipes={mealPlanData.recipes}
                  plannedMeals={mealPlanData.plannedMeals}
                  loading={mealPlanData.loading}
                  nutritionTargets={nutritionTargets}
                  onDataChanged={mealPlanData.reload}
                />
              </div>
              <Card className="p-3">
                <div className="flex gap-1 rounded-xl bg-brand-chip-neutral p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDesktopRightPanelTab("recipes")}
                    className={cn(
                      "flex-1 rounded-full",
                      desktopRightPanelTab === "recipes" &&
                        "bg-white text-brand-accent-dark shadow-sm",
                    )}
                  >
                    Rezepte
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDesktopRightPanelTab("shopping")}
                    className={cn(
                      "flex-1 rounded-full",
                      desktopRightPanelTab === "shopping" &&
                        "bg-white text-brand-accent-dark shadow-sm",
                    )}
                  >
                    Einkaufsliste
                  </Button>
                </div>

                <div>
                  {desktopRightPanelTab === "recipes" ? (
                    <RecipeLibrary key={recipeLibraryRefreshKey} />
                  ) : (
                    <ShoppingList items={shoppingListItems} />
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* Mobile layout: single active tab, switched via the bottom nav */}
          <div className="space-y-4 lg:hidden">
            {mobileTab === "plan" && (
              <MealWeekView
                recipes={mealPlanData.recipes}
                plannedMeals={mealPlanData.plannedMeals}
                loading={mealPlanData.loading}
                nutritionTargets={nutritionTargets}
                onDataChanged={mealPlanData.reload}
              />
            )}
            {mobileTab === "shopping" && (
              <Card className="p-3">
                <ShoppingList items={shoppingListItems} />
              </Card>
            )}
            {mobileTab === "recipes" && (
              <Card className="p-3">
                <RecipeLibrary key={recipeLibraryRefreshKey} />
              </Card>
            )}
          </div>
        </main>

        <MobileTabBar activeTab={mobileTab} onTabChange={setMobileTab} />
      </div>

      {stack.map((entry, index) => (
        <div key={entry.key} className={cn(index < stack.length - 1 && "hidden")}>
          {renderScreen(entry.screen)}
        </div>
      ))}
    </>
  );
}
