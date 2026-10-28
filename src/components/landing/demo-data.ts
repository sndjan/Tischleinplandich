import type { MealType, PlannedMeal, Recipe } from "@/types/database";
import type { RecipeDraft } from "@/lib/recipe-draft";
import type { NutritionTargetSettings } from "@/components/meal-planner/nutrition-target-settings";

// Sample data for the landing page demo. The recipes have the same shape as real
// ones, so the planner's own components and shopping list logic work on them.

export type DemoMeal = PlannedMeal;

export const DEMO_TARGETS: NutritionTargetSettings = {
  calories_target: 2000,
  protein_target: 150,
  carbs_target: 250,
  fats_target: 70,
  calories_target_enabled: true,
  protein_target_enabled: true,
  carbs_target_enabled: true,
  fats_target_enabled: true,
  show_nutrition: true,
};

export const DEMO_PANTRY_STAPLES = ["salz", "olivenöl", "currypulver"];

type RecipeInput = {
  name: string;
  prep: string;
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  ingredients: string[];
  steps: string[];
  tags: string[];
};

function demoRecipe(id: string, input: RecipeInput): Recipe {
  return {
    id,
    user_id: "demo",
    name: input.name,
    ingredients: input.ingredients.join("\n"),
    preparation_steps: input.steps.join("\n"),
    source_url: null,
    prep_time: input.prep,
    calories: input.kcal,
    protein: input.protein,
    carbs: input.carbs,
    fats: input.fats,
    serving_size: 1,
    image_url: null,
    is_public: false,
    share_id: null,
    rating: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const RECIPE_INPUTS: Record<string, RecipeInput> = {
  oats: {
    name: "Overnight Oats mit Beeren",
    prep: "5 Min.",
    kcal: 420, protein: 18, carbs: 58, fats: 12,
    ingredients: ["60 g Haferflocken", "150 g Naturjoghurt", "100 g Heidelbeeren", "1 TL Honig"],
    steps: ["Haferflocken mit Joghurt verrühren.", "Über Nacht im Kühlschrank ziehen lassen.", "Mit Heidelbeeren und Honig servieren."],
    tags: ["Frühstück"],
  },
  egg: {
    name: "Rührei auf Vollkornbrot",
    prep: "10 Min.",
    kcal: 450, protein: 26, carbs: 32, fats: 22,
    ingredients: ["3 Eier", "2 Scheiben Vollkornbrot", "1 Bund Schnittlauch", "1 Prise Salz"],
    steps: ["Eier verquirlen und salzen.", "In der Pfanne bei mittlerer Hitze stocken lassen.", "Auf dem Brot mit Schnittlauch anrichten."],
    tags: ["Frühstück"],
  },
  skyr: {
    name: "Skyr mit Walnüssen",
    prep: "2 Min.",
    kcal: 250, protein: 22, carbs: 14, fats: 11,
    ingredients: ["150 g Skyr", "20 g Walnüsse", "1 TL Honig"],
    steps: ["Skyr in eine Schale geben.", "Mit Walnüssen und Honig toppen."],
    tags: ["Snack"],
  },
  dal: {
    name: "Linsen-Dal mit Reis",
    prep: "30 Min.",
    kcal: 610, protein: 24, carbs: 88, fats: 16,
    ingredients: ["120 g Rote Linsen", "200 ml Kokosmilch", "80 g Reis", "1 Zwiebel", "1 TL Currypulver"],
    steps: ["Zwiebel würfeln und anschwitzen.", "Linsen, Curry und Kokosmilch zugeben, 15 Minuten köcheln.", "Mit dem Reis servieren."],
    tags: ["Mittagessen", "Vegetarisch"],
  },
  bowl: {
    name: "Hähnchen-Bowl",
    prep: "25 Min.",
    kcal: 680, protein: 45, carbs: 70, fats: 20,
    ingredients: ["150 g Hähnchenbrust", "80 g Reis", "1 Paprika", "1 EL Olivenöl"],
    steps: ["Reis kochen.", "Hähnchen in Streifen schneiden und im Öl anbraten.", "Paprika dazugeben und alles in einer Schale anrichten."],
    tags: ["Mittagessen", "High Protein"],
  },
  veg: {
    name: "Ofengemüse mit Feta",
    prep: "35 Min.",
    kcal: 540, protein: 22, carbs: 35, fats: 34,
    ingredients: ["2 Paprika", "1 Zucchini", "100 g Feta", "2 EL Olivenöl"],
    steps: ["Ofen auf 200 °C vorheizen.", "Gemüse schneiden, mit Öl mischen und 25 Minuten backen.", "Feta darüberbröseln."],
    tags: ["Abendessen", "Vegetarisch"],
  },
  pasta: {
    name: "Pasta Pomodoro",
    prep: "20 Min.",
    kcal: 650, protein: 20, carbs: 105, fats: 14,
    ingredients: ["125 g Spaghetti", "400 g Dosentomaten", "1 Knoblauchzehe", "1 Bund Basilikum"],
    steps: ["Spaghetti kochen.", "Knoblauch anschwitzen, Tomaten zugeben und einkochen.", "Mit Pasta und Basilikum mischen."],
    tags: ["Abendessen"],
  },
  salmon: {
    name: "Lachs mit Ofenkartoffeln",
    prep: "40 Min.",
    kcal: 620, protein: 38, carbs: 50, fats: 26,
    ingredients: ["150 g Lachsfilet", "300 g Kartoffeln", "1 Zitrone", "1 EL Olivenöl"],
    steps: ["Kartoffeln vierteln, mit Öl mischen und 30 Minuten backen.", "Lachs die letzten 12 Minuten mitbacken.", "Mit Zitrone servieren."],
    tags: ["Abendessen", "High Protein"],
  },
};

export const DEMO_RECIPES: Recipe[] = Object.entries(RECIPE_INPUTS).map(([id, input]) => demoRecipe(id, input));

export const DEMO_TAGS_BY_ID: Record<string, string[]> = Object.fromEntries(
  Object.entries(RECIPE_INPUTS).map(([id, input]) => [id, input.tags]),
);

// What the pretend AI import "finds" behind the example link.
export const IMPORT_LINK = "https://www.chefkoch.de/rezepte/shakshuka-mit-feta";
export const IMPORTED_RECIPE_ID = "shakshuka";
const IMPORTED_INPUT: RecipeInput = {
  name: "Shakshuka mit Feta",
  prep: "25 Min.",
  kcal: 480, protein: 27, carbs: 24, fats: 30,
  ingredients: ["3 Eier", "400 g Dosentomaten", "1 Paprika", "1 Zwiebel", "50 g Feta"],
  steps: [
    "Zwiebel und Paprika würfeln und anbraten.",
    "Tomaten zugeben und 10 Minuten einkochen.",
    "Mulden formen, Eier hineingeben und zugedeckt stocken lassen.",
    "Mit Feta bestreuen.",
  ],
  tags: ["Frühstück", "Vegetarisch"],
};
export const IMPORTED_RECIPE: Recipe = { ...demoRecipe(IMPORTED_RECIPE_ID, IMPORTED_INPUT), source_url: IMPORT_LINK };
export const IMPORTED_TAGS = IMPORTED_INPUT.tags;

export function importedDraft(ingredientCount: number, stepCount: number, withNutrition: boolean): RecipeDraft {
  return {
    name: IMPORTED_INPUT.name,
    ingredients: IMPORTED_INPUT.ingredients.slice(0, ingredientCount).join("\n"),
    preparation_steps: IMPORTED_INPUT.steps.slice(0, stepCount).join("\n"),
    source_url: IMPORT_LINK,
    prep_time: IMPORTED_INPUT.prep,
    tags: IMPORTED_INPUT.tags,
    calories: withNutrition ? IMPORTED_INPUT.kcal : null,
    protein: withNutrition ? IMPORTED_INPUT.protein : null,
    carbs: withNutrition ? IMPORTED_INPUT.carbs : null,
    fats: withNutrition ? IMPORTED_INPUT.fats : null,
    serving_size: 1,
  };
}

/**
 * A partly planned week around today: yesterday is full, today still has a free
 * lunch, the next days have a few meals.
 */
export function initialDemoMeals(todayIndex: number): DemoMeal[] {
  // Other days of the same Mon–Sun week, never today and never the same day twice.
  const yesterday = todayIndex > 0 ? todayIndex - 1 : 3;
  const tomorrow = todayIndex < 6 ? todayIndex + 1 : 4;
  const later = todayIndex < 5 ? todayIndex + 2 : 3;

  const plan: [day: number, mealType: MealType, recipeId: string][] = [
    [yesterday, "breakfast", "egg"],
    [yesterday, "lunch", "bowl"],
    [yesterday, "dinner", "pasta"],
    [todayIndex, "breakfast", "oats"],
    [todayIndex, "dinner", "salmon"],
    [tomorrow, "lunch", "dal"],
    [later, "dinner", "veg"],
  ];

  return plan.map(([day_of_week, meal_type, recipe_id], index) => ({
    id: `demo-${index}`,
    meal_plan_id: "demo",
    recipe_id,
    day_of_week,
    meal_type,
    serving_size: 1,
    created_at: "2026-01-01T00:00:00Z",
  }));
}
