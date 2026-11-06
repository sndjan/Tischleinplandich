import type { HouseholdRole } from "@/types/database";

// Limits enforced by migration 030; repeated here for the UI hints.
export const MAX_SHARED_HOUSEHOLDS = 2;
export const MAX_HOUSEHOLD_MEMBERS = 10;
export const HOUSEHOLD_NAME_MAX_LENGTH = 40;

export type HouseholdMember = {
  userId: string;
  displayName: string | null;
  role: HouseholdRole;
  joinedAt: string;
};

export type Household = {
  id: string;
  // Null for the personal household.
  name: string | null;
  isPersonal: boolean;
  // The signed-in user's role.
  role: HouseholdRole;
  defaultServings: number | null;
  // Shared list settings (migration 031); defaults until it has run.
  shoppingHideBasics: boolean;
  shoppingSectionOrder: string[];
  members: HouseholdMember[];
};

export type HouseholdsData = {
  // False until migration 030 has run; the app then works as before, alone.
  ready: boolean;
  households: Household[];
  activeHouseholdId: string | null;
};

export const HOUSEHOLDS_NOT_READY: HouseholdsData = { ready: false, households: [], activeHouseholdId: null };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown) => (typeof value === "string" ? value : null);

/**
 * Reads the result of the get_my_households function, skipping anything malformed.
 */
export function parseHouseholds(value: unknown): HouseholdsData {
  if (!isObject(value)) return { ready: true, households: [], activeHouseholdId: null };

  const households: Household[] = [];

  for (const entry of Array.isArray(value.households) ? value.households : []) {
    if (!isObject(entry)) continue;
    const id = asString(entry.id);
    if (!id) continue;

    const members: HouseholdMember[] = [];
    for (const member of Array.isArray(entry.members) ? entry.members : []) {
      if (!isObject(member)) continue;
      const userId = asString(member.user_id);
      if (!userId) continue;
      members.push({
        userId,
        displayName: asString(member.display_name),
        role: member.role === "owner" ? "owner" : "member",
        joinedAt: asString(member.joined_at) ?? "",
      });
    }

    const servings = Number(entry.default_servings);

    households.push({
      id,
      name: asString(entry.name),
      isPersonal: entry.is_personal === true,
      role: entry.role === "owner" ? "owner" : "member",
      defaultServings: entry.default_servings != null && Number.isFinite(servings) ? servings : null,
      shoppingHideBasics: entry.shopping_hide_basics !== false,
      shoppingSectionOrder: Array.isArray(entry.shopping_section_order)
        ? entry.shopping_section_order.filter((id): id is string => typeof id === "string")
        : [],
      members,
    });
  }

  return { ready: true, households, activeHouseholdId: asString(value.active_household_id) };
}

/**
 * The household the app shows: the stored active one if the user is still in it,
 * else the personal one. Null before migration 030.
 */
export function getActiveHousehold(data: HouseholdsData): Household | null {
  return (
    data.households.find((household) => household.id === data.activeHouseholdId) ??
    data.households.find((household) => household.isPersonal) ??
    null
  );
}

export const sharedHouseholds = (data: HouseholdsData) => data.households.filter((household) => !household.isPersonal);

/**
 * Portions a new meal starts with: the household's number of people, which
 * defaults to its member count. Alone it stays one portion, as before.
 */
export function getDefaultServings(household: Household | null): number {
  if (!household || household.isPersonal) return 1;
  return household.defaultServings ?? Math.max(1, household.members.length);
}

export const householdLabel = (household: Pick<Household, "name" | "isPersonal">) =>
  household.isPersonal ? "Persönlich" : household.name || "Haushalt";

/**
 * "Anna, Ben und Chris" for the member line of a household.
 */
export function formatMemberNames(names: (string | null)[], max = 3): string {
  const shown = names.map((name) => name?.trim() || "Jemand");
  if (shown.length === 0) return "";
  if (shown.length > max) return `${shown.slice(0, max).join(", ")} und ${shown.length - max} weitere`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} und ${shown[shown.length - 1]}`;
}

/**
 * German message for an error raised by the household functions (migration 030),
 * which put the reason in the message.
 */
export function householdErrorMessage(error: unknown): string {
  const message = isObject(error) ? asString(error.message) ?? "" : "";

  if (message.includes("household_limit_reached")) {
    return `Du kannst in höchstens ${MAX_SHARED_HOUSEHOLDS} gemeinsamen Haushalten sein.`;
  }
  if (message.includes("household_full")) return `Der Haushalt ist voll (höchstens ${MAX_HOUSEHOLD_MEMBERS} Leute).`;
  if (message.includes("invite_invalid")) return "Der Einladungslink ist abgelaufen oder wurde zurückgesetzt.";
  if (message.includes("display_name_required")) return "Gib dir zuerst einen Namen, damit die anderen wissen, wer du bist.";
  if (message.includes("invalid_name")) return `Der Name braucht 1 bis ${HOUSEHOLD_NAME_MAX_LENGTH} Zeichen.`;
  if (message.includes("not_the_owner")) return "Das darf nur die Person, die den Haushalt angelegt hat.";
  return "Das hat nicht geklappt. Versuch es gleich noch einmal.";
}

// PostgREST "function not found" or Postgres "undefined function"/"undefined table":
// migration 030 has not run yet.
export const isMissingHouseholdsError = (error: { code?: string } | null | undefined) =>
  error?.code === "PGRST202" || error?.code === "42883" || error?.code === "42P01" || error?.code === "PGRST205";

const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export const isInviteToken = (value: string) => INVITE_TOKEN_PATTERN.test(value);

export const inviteUrl = (origin: string, token: string) => `${origin}/einladen/${token}`;

// "Alle", the user's own recipes, or one other member's.
export type RecipeAuthorFilter = "all" | "me" | { userId: string };

// Same name and ingredients, ignoring case and spacing: a copy someone saved
// ("Kopie speichern", "Entdecken") of another member's recipe.
const recipeContentKey = (recipe: { name: string; ingredients: string }) =>
  `${recipe.name.trim().toLowerCase()}\n${recipe.ingredients.replace(/\s+/g, " ").trim().toLowerCase()}`;

/**
 * The "Haushalt" tab's list: the user's own recipes and the other members',
 * newest first, narrowed to one person if asked. Showing everyone, copies of
 * the same recipe appear once: the user's own if they have one (it can be
 * edited and rated), else the oldest, i.e. the original.
 */
export function combineHouseholdRecipes<
  T extends { id: string; user_id: string; created_at: string; name: string; ingredients: string },
>(own: T[], others: T[], userId: string | null, filter: RecipeAuthorFilter): T[] {
  const ownIds = new Set(own.map((recipe) => recipe.id));
  const oldestFirst = (a: T, b: T) => a.created_at.localeCompare(b.created_at);
  const all = [...own, ...others.filter((recipe) => !ownIds.has(recipe.id)).sort(oldestFirst)];

  let shown: T[];
  if (filter === "all") {
    const seen = new Set<string>();
    shown = all.filter((recipe) => {
      const key = recipeContentKey(recipe);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } else {
    shown = all.filter((recipe) => (filter === "me" ? recipe.user_id === userId : recipe.user_id === filter.userId));
  }

  return shown.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
