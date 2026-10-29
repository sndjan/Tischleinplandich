import type { ShoppingListItem } from "@/types/database";

export type ShoppingSectionId =
  | "produce"
  | "bakery"
  | "dairy"
  | "meat"
  | "dry"
  | "canned"
  | "spices"
  | "frozen"
  | "drinks"
  | "other";

// In the order of a typical walk through the store.
export const SHOPPING_SECTIONS: { id: ShoppingSectionId; label: string; emoji: string }[] = [
  { id: "produce", label: "Obst & Gemüse", emoji: "🥬" },
  { id: "bakery", label: "Brot & Backwaren", emoji: "🥖" },
  { id: "dairy", label: "Kühlregal", emoji: "🧀" },
  { id: "meat", label: "Fleisch & Fisch", emoji: "🥩" },
  { id: "dry", label: "Trockenwaren", emoji: "🌾" },
  { id: "canned", label: "Konserven & Gläser", emoji: "🥫" },
  { id: "spices", label: "Gewürze & Öle", emoji: "🧂" },
  { id: "frozen", label: "Tiefkühl", emoji: "❄️" },
  { id: "drinks", label: "Getränke", emoji: "🥤" },
  { id: "other", label: "Sonstiges", emoji: "🛒" },
];

/**
 * The sections in the user's own order (e.g. dry goods first, as the store is laid
 * out). Unknown ids are dropped and sections missing from it keep their default
 * place at the end, so a stored order survives new sections.
 */
export function orderShoppingSections(order: readonly string[] = []) {
  const byId = new Map(SHOPPING_SECTIONS.map((section) => [section.id as string, section]));
  const ordered = [...new Set(order)].flatMap((id) => byId.get(id) ?? []);
  return [...ordered, ...SHOPPING_SECTIONS.filter((section) => !ordered.includes(section))];
}

// Keywords per section. The longest keyword found in the ingredient name wins, so
// "Kokosmilch" lands in Konserven (not Kühlregal via "milch") and "Olivenöl" in
// Gewürze & Öle (not Konserven via "oliven"). Keywords starting with "=" must
// match a whole word ("ei" should not match "Weizen").
const SECTION_KEYWORDS: Record<Exclude<ShoppingSectionId, "other">, string[]> = {
  produce: [
    "apfel", "äpfel", "banane", "beere", "erdbeer", "himbeer", "heidelbeer", "blaubeer",
    "preiselbeere", "zitrone", "limette", "orange", "mandarine", "mango", "ananas", "avocado",
    "tomate", "kirschtomate", "cocktailtomate", "gurke", "paprika", "zucchini", "aubergine",
    "karotte", "möhre", "zwiebel", "schalotte", "knoblauch", "ingwer", "kartoffel",
    "süßkartoffel", "spinat", "salat", "rucola", "feldsalat", "kohl", "brokkoli", "broccoli",
    "pilz", "champignon", "lauch", "porree", "sellerie", "fenchel", "kürbis", "kohlrabi",
    "frühlingszwiebel", "lauchzwiebel", "petersilie", "basilikum", "koriander", "minze", "dill",
    "schnittlauch", "frische kräuter", "radieschen", "rote bete", "chili", "jalapeño",
    "spargel", "kiwi", "weintraube", "traube", "pfirsich", "nektarine", "birne",
    "granatapfel", "feige", "zuckerschote", "grüne bohnen", "rhabarber", "pastinake",
    "apple", "banana", "berries", "lemon", "lime", "onion", "garlic", "tomato", "cucumber",
    "spinach", "carrot", "potato", "ginger", "mushroom", "lettuce", "parsley", "cilantro",
  ],
  bakery: [
    "brot", "brötchen", "toast", "baguette", "tortilla", "wrap", "fladenbrot", "pita",
    "naan", "bagel", "ciabatta", "bread", "bun",
  ],
  dairy: [
    "milch", "joghurt", "skyr", "quark", "käse", "feta", "mozzarella", "parmesan", "ricotta",
    "frischkäse", "hüttenkäse", "butter", "sahne", "schmand", "crème fraîche", "creme fraiche",
    "mandelmilch", "sojamilch", "=ei", "=eier", "eigelb", "eiweiß", "tofu", "tempeh", "halloumi", "burrata", "mascarpone",
    "gouda", "cheddar", "emmentaler", "hafermilch", "sojajoghurt", "gnocchi", "frische nudeln",
    "blätterteig", "hefeteig", "pizzateig", "egg", "cheese", "yogurt", "cream",
  ],
  meat: [
    "hähnchen", "huhn", "hühnchen", "pute", "rind", "hack", "schwein", "speck", "schinken",
    "salami", "wurst", "lachs", "fisch", "kabeljau", "garnele", "shrimp", "lamm", "steak",
    "filet", "chicken", "beef", "pork", "salmon", "bacon",
  ],
  dry: [
    "nudel", "pasta", "spaghetti", "penne", "fusilli", "farfalle", "rigatoni", "tagliatelle",
    "orzo", "lasagne", "reis", "quinoa", "couscous", "bulgur", "hafer", "haferflocken", "mehl",
    "zucker", "linsen", "kichererbsen", "bohnen", "nüsse", "nuss", "mandel", "walnuss", "cashew",
    "erdnüsse", "pinienkerne", "samen", "kerne", "chia", "leinsamen", "sesam", "rosinen",
    "dattel", "müsli", "granola", "backpulver", "natron", "hefe", "schokolade", "kakao",
    "polenta", "grieß", "ramen", "reisnudeln", "glasnudeln", "proteinpulver", "cornflakes",
    "paniermehl", "semmelbrösel", "maisstärke", "speisestärke", "rice", "oats", "flour", "sugar", "lentils", "chickpeas",
  ],
  canned: [
    "dose", "passierte", "gehackte tomaten", "stückige tomaten", "tomatenmark", "kokosmilch",
    "brühe", "fond", "bouillon", "pesto", "oliven", "kapern", "essiggurke", "senf", "ketchup",
    "mayo", "sojasauce", "sojasoße", "sojasosse", "currypaste", "tahini", "tahin",
    "erdnussbutter", "erdnussmus", "mandelmus", "honig", "ahornsirup", "agavendicksaft",
    "marmelade", "sriracha", "salsa", "sambal", "fischsauce", "worcester", "teriyaki",
    "kidneybohnen", "maiskörner", "mais", "coconut milk", "stock", "broth",
  ],
  spices: [
    "salz", "pfeffer", "öl", "olivenöl", "rapsöl", "sesamöl", "kokosöl", "sonnenblumenöl",
    "essig", "balsamico", "paprikapulver", "edelsüß", "geräuchert", "kreuzkümmel", "kumin",
    "kurkuma", "zimt", "currypulver", "curry", "oregano", "thymian", "rosmarin",
    "chiliflocken", "chilipulver", "cayenne", "muskat", "lorbeer", "vanille", "gewürz",
    "garam masala", "kümmel", "koriandersamen", "zatar", "za'atar", "italienische kräuter",
    "kräuter der provence", "salt", "oil", "vinegar", "cumin", "cinnamon",
  ],
  frozen: [
    "erbsen", "edamame", "frozen", "eiswürfel",
  ],
  drinks: [
    "=wasser", "mineralwasser", "saft", "=wein", "weißwein", "rotwein", "bier", "kaffee",
    "=tee", "water", "juice", "wine",
  ],
};

const KEYWORDS = Object.entries(SECTION_KEYWORDS).flatMap(([section, words]) =>
  words.map((word) => ({
    section: section as ShoppingSectionId,
    word: word.replace(/^=/, ""),
    wholeWord: word.startsWith("="),
  })),
);

export function getShoppingSection(item: Pick<ShoppingListItem, "ingredient" | "unit">): ShoppingSectionId {
  const name = item.ingredient.toLowerCase();

  const words = name.split(/[^a-zäöüß']+/);

  // How it is bought beats what it is: "TK-Spinat" is frozen, "1 Dose Mais" canned.
  if (words.includes("tk") || /tiefkühl|tiefgekühlt|gefroren/.test(name)) return "frozen";
  if (item.unit === "can") return "canned";

  let best: { section: ShoppingSectionId; length: number } | null = null;

  for (const { section, word, wholeWord } of KEYWORDS) {
    const matches = wholeWord ? words.includes(word) : name.includes(word);
    if (matches && (!best || word.length > best.length)) {
      best = { section, length: word.length };
    }
  }

  return best?.section ?? "other";
}

// Units as German shoppers write them: [singular, plural].
const UNIT_LABELS: Record<string, [string, string]> = {
  tbsp: ["EL", "EL"],
  tsp: ["TL", "TL"],
  can: ["Dose", "Dosen"],
  pack: ["Packung", "Packungen"],
  pinch: ["Prise", "Prisen"],
  clove: ["Zehe", "Zehen"],
  cup: ["Tasse", "Tassen"],
  pc: ["Stück", "Stück"],
};

const FRACTIONS: [number, string][] = [
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

const formatDecimal = (value: number, maximumFractionDigits: number) =>
  value.toLocaleString("de-DE", { maximumFractionDigits });

// Counts like eggs or onions: whole numbers and the common fractions (1½, ¾).
export function formatCount(value: number) {
  const whole = Math.floor(value);
  const rest = value - whole;

  if (rest < 0.08) return String(whole || 1);
  if (rest > 0.92) return String(whole + 1);

  const [, glyph] = FRACTIONS.reduce((closest, candidate) =>
    Math.abs(candidate[0] - rest) < Math.abs(closest[0] - rest) ? candidate : closest,
  );

  return whole > 0 ? `${whole}${glyph}` : glyph;
}

// Weights and volumes: no false precision ("62,5 g" becomes "65 g").
export function formatMeasure(value: number) {
  if (value >= 100) return formatDecimal(Math.round(value / 5) * 5, 0);
  if (value >= 10) return formatDecimal(Math.round(value), 0);
  return formatDecimal(Math.round(value * 2) / 2, 1);
}

/**
 * Amount the way it reads on a German shopping list: "½", "2 Zehen", "65 g", "1,5 kg".
 */
export function formatShoppingAmount(quantity: number, unit: string): string {
  if (unit === "g" || unit === "ml") return `${formatMeasure(quantity)} ${unit}`;
  if (unit === "kg" || unit === "l") return `${formatDecimal(quantity, 2)} ${unit}`;
  if (unit === "mg") return `${formatDecimal(quantity, 0)} mg`;

  const count = formatCount(quantity);
  const labels = UNIT_LABELS[unit];

  if (labels) return `${count} ${quantity > 1 ? labels[1] : labels[0]}`;
  return unit ? `${count} ${unit}` : count;
}

export function shoppingItemLabel(item: ShoppingListItem) {
  if (item.label) return item.label;
  return item.ingredient.charAt(0).toUpperCase() + item.ingredient.slice(1);
}
