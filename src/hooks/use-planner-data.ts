"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/client";
import type { PlannedMeal, Recipe } from "@/types/database";
import { withSafeLinks } from "@/lib/safe-links";
import {
  getActiveHousehold,
  HOUSEHOLDS_NOT_READY,
  isMissingHouseholdsError,
  parseHouseholds,
  type Household,
  type HouseholdsData,
} from "@/lib/households";
import { useSelectedWeek } from "./use-selected-week";

// Meals added optimistically carry this id prefix until the server row arrives.
export const PENDING_ID_PREFIX = "pending-";

export const isPendingId = (id: string) => id.startsWith(PENDING_ID_PREFIX);

export const queryKeys = {
  recipes: (userId: string) => ["recipes", userId] as const,
  // householdKey: the household's id, or "own" before migration 030.
  week: (userId: string, householdKey: string, weekStart: string) =>
    ["week", userId, householdKey, weekStart] as const,
  allWeeks: (userId: string) => ["week", userId] as const,
  households: (userId: string) => ["households", userId] as const,
  householdRecipes: (householdId: string) => ["household-recipes", householdId] as const,
  nutritionTargets: (userId: string) => ["nutrition-targets", userId] as const,
  // householdKey: the household's id, or "own" before migration 031.
  pantryStaples: (userId: string, householdKey: string) => ["pantry-staples", userId, householdKey] as const,
  shopping: (householdId: string, weekStart: string) => ["shopping", householdId, weekStart] as const,
  profile: (userId: string) => ["profile", userId] as const,
  discover: (search: string) => ["discover", search] as const,
};

export type ProfileData = {
  displayName: string | null;
  // False until migration 011 adds users.display_name and the sharing columns.
  sharingReady: boolean;
};

// Postgres "undefined column": the sharing migration has not been run yet.
export const isMissingColumnError = (error: { code?: string } | null) => error?.code === "42703";

export type RecipesData = {
  recipes: Recipe[];
  tagsById: Record<string, string[]>;
};

// Another member's recipe in a shared household (migration 030). The rating is
// always null: it stays private to the owner.
export type HouseholdRecipe = Recipe & { author_name: string | null; tags: string[] };

export type WeekData = {
  mealPlanId: string | null;
  meals: PlannedMeal[];
};

const getTagNames = (recipeTags: unknown): string[] => {
  const names = new Map<string, string>();

  for (const entry of (recipeTags ?? []) as Array<{ tags: unknown }>) {
    const tag = Array.isArray(entry.tags) ? entry.tags[0] : entry.tags;
    const name = (tag as { name?: string } | null)?.name;

    if (name && !names.has(name.toLowerCase())) {
      names.set(name.toLowerCase(), name);
    }
  }

  return [...names.values()].sort((a, b) => a.localeCompare(b));
};

export async function fetchRecipes(userId: string): Promise<RecipesData> {
  // Tags come along in the same request instead of one request per recipe.
  const { data, error } = await createClient()
    .from("recipes")
    .select("*, recipe_tags(tags(name))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const recipes: Recipe[] = [];
  const tagsById: Record<string, string[]> = {};

  for (const row of (data ?? []) as Array<Recipe & { recipe_tags?: unknown }>) {
    const { recipe_tags: recipeTags, ...recipe } = row;
    recipes.push(withSafeLinks(recipe));
    tagsById[recipe.id] = getTagNames(recipeTags);
  }

  return { recipes, tagsById };
}

// Meals removed in the app whose delete waits for the undo window to pass. A
// refetch in the meantime (e.g. after another removal is committed) still
// returns them, so they are left out here.
export const mealsAwaitingRemoval = new Set<string>();

/**
 * The week's plan of a household, or of the user before migration 030
 * (householdId null), when plans still belonged to a user.
 */
export async function fetchWeek(userId: string, householdId: string | null, weekStart: string): Promise<WeekData> {
  const query = createClient().from("meal_plans").select("id, planned_meals(*)").eq("week_start_date", weekStart);
  const { data, error } = await (householdId
    ? query.eq("household_id", householdId)
    : query.eq("user_id", userId)
  ).maybeSingle();

  if (error) throw error;

  const plan = data as { id: string; planned_meals: PlannedMeal[] | null } | null;

  return {
    mealPlanId: plan?.id ?? null,
    meals: (plan?.planned_meals ?? []).filter((meal) => !mealsAwaitingRemoval.has(meal.id)),
  };
}

/**
 * The signed-in user's id, or null while the session is loading or signed out.
 */
export function useUserId(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}

export function useRecipesQuery() {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.recipes(userId ?? ""),
    queryFn: () => fetchRecipes(userId!),
    enabled: Boolean(userId),
  });
}

export async function fetchHouseholds(): Promise<HouseholdsData> {
  const { data, error } = await createClient().rpc("get_my_households");
  if (isMissingHouseholdsError(error)) return HOUSEHOLDS_NOT_READY;
  if (error) throw error;
  return parseHouseholds(data);
}

export function useHouseholdsQuery() {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.households(userId ?? ""),
    queryFn: fetchHouseholds,
    enabled: Boolean(userId),
  });
}

/**
 * The household the planner shows (null before migration 030), and whether that
 * is known yet; the week can only be loaded once it is.
 */
export function useActiveHousehold(): {
  household: Household | null;
  isShared: boolean;
  data: HouseholdsData | undefined;
  resolved: boolean;
} {
  const { data } = useHouseholdsQuery();

  return useMemo(() => {
    const household = data ? getActiveHousehold(data) : null;
    return { household, isShared: Boolean(household && !household.isPersonal), data, resolved: data !== undefined };
  }, [data]);
}

/**
 * Cache key and scope of the selected week in the active household.
 */
export function useWeekScope() {
  const userId = useUserId();
  const { weekKey: weekStart } = useSelectedWeek();
  const { household, resolved } = useActiveHousehold();
  const householdId = household?.id ?? null;

  return useMemo(
    () => ({
      userId,
      householdId,
      weekStart,
      resolved,
      queryKey: queryKeys.week(userId ?? "", householdId ?? "own", weekStart),
    }),
    [userId, householdId, weekStart, resolved],
  );
}

export function useWeekQuery() {
  const { userId, householdId, weekStart, resolved, queryKey } = useWeekScope();

  return useQuery({
    queryKey,
    queryFn: () => fetchWeek(userId!, householdId, weekStart),
    enabled: Boolean(userId) && resolved,
  });
}

/**
 * Everything the week view and shopping list need, from the shared cache.
 * `loading` is only true when nothing is cached yet, so later visits render
 * the last known data immediately while it refreshes in the background.
 */
/**
 * The other members' recipes while a shared household is active, so their
 * planned meals show and can be planned directly. Empty otherwise.
 */
export function useHouseholdRecipesQuery() {
  const { household, isShared } = useActiveHousehold();

  return useQuery({
    queryKey: queryKeys.householdRecipes(household?.id ?? ""),
    enabled: isShared,
    queryFn: async (): Promise<HouseholdRecipe[]> => {
      const { data, error } = await createClient().rpc("household_recipes", { p_household_id: household!.id });
      if (error) throw error;
      return ((data ?? []) as unknown as HouseholdRecipe[]).map((recipe) =>
        withSafeLinks({ ...recipe, tags: Array.isArray(recipe.tags) ? recipe.tags : [] }),
      );
    },
  });
}

const NO_HOUSEHOLD_RECIPES: HouseholdRecipe[] = [];

/**
 * Everything the week view and shopping list need, from the shared cache.
 * `loading` is only true when nothing is cached yet, so later visits render
 * the last known data immediately while it refreshes in the background.
 * `recipes` holds the user's own recipes plus, in a shared household, the
 * other members' ones.
 */
export function useMealPlanData() {
  const recipesQuery = useRecipesQuery();
  const weekQuery = useWeekQuery();
  const { household, isShared } = useActiveHousehold();
  const householdRecipesQuery = useHouseholdRecipesQuery();

  const ownRecipes = recipesQuery.data?.recipes;
  const ownTagsById = recipesQuery.data?.tagsById;
  const memberRecipes = isShared ? householdRecipesQuery.data ?? NO_HOUSEHOLD_RECIPES : NO_HOUSEHOLD_RECIPES;
  const meals = weekQuery.data?.meals;

  return useMemo(() => {
    const own = ownRecipes ?? [];
    const ownIds = new Set(own.map((recipe) => recipe.id));
    const others = memberRecipes.filter((recipe) => !ownIds.has(recipe.id));
    const tagsById = { ...(ownTagsById ?? {}) };
    for (const recipe of others) tagsById[recipe.id] = recipe.tags;

    return {
      recipes: others.length > 0 ? [...own, ...others] : own,
      tagsById,
      plannedMeals: meals ?? [],
      household,
      isSharedHousehold: isShared,
      loading: recipesQuery.isPending || weekQuery.isPending,
      refreshing: recipesQuery.isFetching || weekQuery.isFetching,
    };
  }, [
    ownRecipes,
    ownTagsById,
    memberRecipes,
    meals,
    household,
    isShared,
    recipesQuery.isPending,
    weekQuery.isPending,
    recipesQuery.isFetching,
    weekQuery.isFetching,
  ]);
}

export function useProfileQuery() {
  const userId = useUserId();

  return useQuery({
    queryKey: queryKeys.profile(userId ?? ""),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ProfileData> => {
      const { data, error } = await createClient()
        .from("users")
        .select("display_name")
        .eq("id", userId!)
        .maybeSingle();

      if (isMissingColumnError(error)) return { displayName: null, sharingReady: false };
      if (error) throw error;

      return { displayName: data?.display_name ?? null, sharingReady: true };
    },
  });
}
