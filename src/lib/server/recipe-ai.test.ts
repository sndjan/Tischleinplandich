import { beforeAll, describe, expect, it } from "vitest";

// The module creates an API client on import, which needs a key.
process.env.ANTHROPIC_API_KEY ??= "test-key";
let toRecipeDraft: typeof import("@/lib/server/recipe-ai").toRecipeDraft;

beforeAll(async () => {
  ({ toRecipeDraft } = await import("@/lib/server/recipe-ai"));
});

const ingredient = (id: string, quantity: number | null, unit: string | null, name: string, kcal: number, fat = 0) => ({
  id,
  quantity,
  unit,
  name,
  base_name: name,
  section: "produce" as const,
  pantry: false,
  perishable: false,
  kcal,
  protein_g: 0,
  carbs_g: kcal / 4 - (fat * 9) / 4,
  fat_g: fat,
});

const base = {
  name: " Pasta ",
  serving_size: 2,
  total_minutes: 35,
  time_from_source: false,
  ingredient_groups: [
    { title: "Für die Pasta", ingredients: [ingredient("z1", 200, "g", "Nudeln", 700)] },
    {
      title: "Für die Soße",
      ingredients: [ingredient("z2", 2, null, "Zwiebeln", 80), ingredient("z3", 1, "EL", "Olivenöl", 120, 13)],
    },
  ],
  steps: [
    { text: "Nudeln 10 Min. kochen.", uses: [{ ingredient_id: "z1", fraction: null }] },
    {
      text: "Die Hälfte der Zwiebeln im Öl anbraten.",
      uses: [
        { ingredient_id: "z2", fraction: 0.5 },
        { ingredient_id: "z3", fraction: 1 },
        { ingredient_id: "unknown", fraction: null },
      ],
    },
  ],
  nutrition_from_source: false,
  calories: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
  equipment: ["Topf", "Pfanne"],
  tips: ["Nudelwasser aufheben."],
};

describe("toRecipeDraft", () => {
  it("writes groups as header lines and steps as text", () => {
    const draft = toRecipeDraft(base);
    expect(draft.name).toBe("Pasta");
    expect(draft.ingredients).toBe("# Für die Pasta\n200 g Nudeln\n# Für die Soße\n2 Zwiebeln\n1 EL Olivenöl");
    expect(draft.preparation_steps).toBe("Nudeln 10 Min. kochen.\nDie Hälfte der Zwiebeln im Öl anbraten.");
    expect(draft.prep_time).toBe("ca. 35 Min.");
  });

  it("leaves out the header of a single group", () => {
    const draft = toRecipeDraft({ ...base, ingredient_groups: [base.ingredient_groups[0]] });
    expect(draft.ingredients).toBe("200 g Nudeln");
  });

  it("maps step ingredients to line positions", () => {
    const draft = toRecipeDraft(base);
    expect(draft.details?.steps).toEqual([
      { uses: [{ i: 0, fraction: null }] },
      { uses: [{ i: 1, fraction: 0.5 }, { i: 2, fraction: null }] },
    ]);
    expect(draft.details?.equipment).toEqual(["Topf", "Pfanne"]);
  });

  it("sums per-ingredient nutrition per portion when the source has none", () => {
    const draft = toRecipeDraft(base);
    expect(draft.calories).toBe(450);
    expect(draft.details?.nutrition_estimated).toBe(true);
    expect(draft.details?.nutrition_warning).toBe(false);
  });

  it("keeps nutrition from the source", () => {
    const draft = toRecipeDraft({ ...base, nutrition_from_source: true, calories: 510, protein: 20, carbs: 70, fats: 16 });
    expect(draft.calories).toBe(510);
    expect(draft.details?.nutrition_estimated).toBe(false);
  });

  it("flags values that don't add up", () => {
    const draft = toRecipeDraft({ ...base, nutrition_from_source: true, calories: 1500, protein: 5, carbs: 20, fats: 5 });
    expect(draft.details?.nutrition_warning).toBe(true);
  });

  it("copes with partial output while streaming", () => {
    const draft = toRecipeDraft({ name: "Pa", ingredient_groups: [{ title: null, ingredients: [{ id: "z1" }] }] } as never);
    expect(draft.ingredients).toBe("");
    expect(draft.calories).toBeNull();
  });
});

describe("AI output schemas", () => {
  // Counts the fields that compile to a type union: anyOf (nullable) or a type array.
  function countUnions(node: unknown): number {
    if (Array.isArray(node)) return node.reduce((sum: number, item) => sum + countUnions(item), 0);
    if (!node || typeof node !== "object") return 0;
    const record = node as Record<string, unknown>;
    const own = "anyOf" in record || Array.isArray(record.type) ? 1 : 0;
    return own + Object.values(record).reduce((sum: number, value) => sum + countUnions(value), 0);
  }

  // The API rejects a request whose output schema has more than 16 union-typed
  // fields ("Parameters with union types" in the structured outputs limits).
  it("stay within the API's limit on nullable fields", async () => {
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const { ExtractedRecipeSchema, RefinedRecipeSchema, RecalculatedRecipeSchema } = await import(
      "@/lib/server/recipe-ai"
    );

    for (const schema of [ExtractedRecipeSchema, RefinedRecipeSchema, RecalculatedRecipeSchema]) {
      expect(countUnions(zodOutputFormat(schema).schema)).toBeLessThanOrEqual(16);
    }
  });

  it("treats 0 minutes as no time", () => {
    const draft = toRecipeDraft({ ...base, active_minutes: 0, total_minutes: 0 });
    expect(draft.prep_time).toBe("");
    expect(draft.details?.total_minutes).toBeNull();
  });
});
