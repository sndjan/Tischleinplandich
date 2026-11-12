// Any origin works: it only serves to see whether the path stays on it.
const BASE = "https://app.invalid";

/**
 * Where to go after signing in. Only paths inside the app are allowed, so a
 * crafted link can't send people to another site.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/meal-planner") {
  // URL parsers drop tabs and newlines, which would turn "/\t/evil.example"
  // into "//evil.example"; no real path contains control characters.
  if (!value || !value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) {
    return fallback;
  }

  try {
    // Resolved the way the redirect will resolve it.
    if (new URL(value, BASE).origin !== BASE) return fallback;
  } catch {
    return fallback;
  }

  return value;
}
