// Keyword → emoji, checked in order, so "Nudelsalat" finds pasta before salad.
const EMOJI_RULES: [RegExp, string][] = [
  [/pizza|flammkuchen/, "🍕"],
  [/burger/, "🍔"],
  [/taco|burrito|wrap|quesadilla|fajita/, "🌯"],
  [/sushi|bowl|poke/, "🍣"],
  [/nudel|pasta|spaghetti|lasagne|penne|tagliatelle|gnocchi|ramen|udon|maultasche/, "🍝"],
  [/curry|dal|dhal|chili/, "🍛"],
  [/suppe|eintopf|brühe|stew/, "🍲"],
  [/salat/, "🥗"],
  [/reis|risotto|paella/, "🍚"],
  [/kuchen|torte|muffin|brownie|cookie|keks/, "🍰"],
  [/pancake|pfannkuchen|waffel|crêpe|crepe/, "🥞"],
  [/müsli|porridge|haferbrei|oats|granola|joghurt/, "🥣"],
  [/smoothie|shake/, "🥤"],
  [/ei\b|eier|omelett|rührei/, "🍳"],
  [/brot|brötchen|sandwich|toast|stulle|bagel/, "🥪"],
  [/lachs|fisch|thunfisch|garnele|shrimp/, "🐟"],
  [/hähnchen|huhn|chicken|pute/, "🍗"],
  [/steak|rind|schwein|braten|gulasch/, "🥩"],
  [/kartoffel|pommes|rösti/, "🥔"],
  [/gemüse|ofengemüse|tofu|vegan/, "🥦"],
];

/**
 * A stand-in for recipes without a photo: a food emoji guessed from the name on
 * a soft color that stays the same for the same name.
 */
export function getRecipePlaceholder(name: string): { emoji: string; hue: number } {
  const lower = name.toLowerCase();
  const emoji = EMOJI_RULES.find(([pattern]) => pattern.test(lower))?.[1] ?? "🍽️";

  let hash = 0;
  for (const char of lower) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;

  return { emoji, hue: hash % 360 };
}
