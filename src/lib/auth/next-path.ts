/**
 * Where to go after signing in. Only paths inside the app are allowed, so a
 * crafted link can't send people to another site.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/meal-planner") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }

  return value;
}
