import { beforeAll, describe, expect, it } from "vitest";

// The module creates an API client on import, which needs a key.
process.env.ANTHROPIC_API_KEY ??= "test-key";
let toRecipeDraft: typeof import("@/lib/server/recipe-ai").toRecipeDraft;

beforeAll(async () => {
  ({ toRecipeDraft } = await import("@/lib/server/recipe-ai"));
});

const ingredient = (group: string, id: string, quantity: number, unit: string, name: string, kcal: number, fat = 0) => ({
  group,
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
  grams: kcal,
  food_group: "vegetables" as const,
  nova: 1,
  whole_grain: false,
  plant: name === "Olivenöl" ? "Olive" : "",
});

const base = {
  name: " Pasta ",
  serving_size: 2,
  total_minutes: 35,
  time_from_source: false,
  ingredients: [
    ingredient("Für die Pasta", "z1", 200, "g", "Nudeln", 700),
    ingredient("Für die Soße", "z2", 2, "", "Zwiebeln", 80),
    ingredient("Für die Soße", "z3", 1, "EL", "Olivenöl", 120, 13),
  ],
  steps: [
    { text: "Nudeln 10 Min. kochen.", uses: [{ ingredient_id: "z1", fraction: 1 }] },
    {
      text: "Die Hälfte der Zwiebeln im Öl anbraten.",
      uses: [
        { ingredient_id: "z2", fraction: 0.5 },
        { ingredient_id: "z3", fraction: 1 },
        { ingredient_id: "unknown", fraction: 1 },
      ],
    },
  ],
  calories: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
  equipment: ["Topf", "Pfanne"],
  tips: ["Nudelwasser aufheben."],
  balance: { fiber_g: 6, added_sugar_g: 0, saturated_fat_g: 2, salt_g: 1 },
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
    const draft = toRecipeDraft({ ...base, ingredients: base.ingredients.map((item) => ({ ...item, group: "Für alles" })) });
    expect(draft.ingredients).toBe("200 g Nudeln\n2 Zwiebeln\n1 EL Olivenöl");
  });

  it("writes no header for ingredients without a group", () => {
    const draft = toRecipeDraft({ ...base, ingredients: [{ ...base.ingredients[0], group: "" }, base.ingredients[1]] });
    expect(draft.ingredients).toBe("200 g Nudeln\n# Für die Soße\n2 Zwiebeln");
  });

  it("leaves out a quantity of 0", () => {
    const draft = toRecipeDraft({ ...base, ingredients: [{ ...base.ingredients[0], quantity: 0, unit: "", name: "Salz" }] });
    expect(draft.ingredients).toBe("Salz");
  });

  it("lists a single ingredient without header", () => {
    const draft = toRecipeDraft({ ...base, ingredients: [base.ingredients[0]] });
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
    const draft = toRecipeDraft({ ...base, calories: 510, protein: 20, carbs: 70, fats: 16 });
    expect(draft.calories).toBe(510);
    expect(draft.details?.nutrition_estimated).toBe(false);
  });

  it("flags values that don't add up", () => {
    const draft = toRecipeDraft({ ...base, calories: 1500, protein: 5, carbs: 20, fats: 5 });
    expect(draft.details?.nutrition_warning).toBe(true);
  });

  it("copes with partial output while streaming", () => {
    const draft = toRecipeDraft({ name: "Pa", ingredients: [{ group: "", id: "z1" }] } as never);
    expect(draft.ingredients).toBe("");
    expect(draft.calories).toBeNull();
    expect(draft.balance).toBeNull();
  });

  it("builds the balance facts per portion from the ingredients", () => {
    const draft = toRecipeDraft(base);
    expect(draft.balance).toMatchObject({
      energy_kcal: 450,
      fiber_g: 6,
      ingredients: [
        { name: "Nudeln", grams: 350, plant: null },
        { name: "Zwiebeln", grams: 40, plant: null },
        { name: "Olivenöl", grams: 60, group: "vegetables", nova: 1, plant: "Olive" },
      ],
    });
  });

  it("treats 0 fridge days as eat fresh", () => {
    expect(toRecipeDraft({ ...base, fridge_days: 0 }).details?.fridge_days).toBeNull();
    expect(toRecipeDraft({ ...base, fridge_days: 3 }).details?.fridge_days).toBe(3);
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

  type JsonSchema = {
    type?: string | string[];
    $ref?: string;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    $defs?: Record<string, JsonSchema>;
  };

  // Estimates the size of the grammar the API compiles from a schema, in the
  // units measured against the API with recipe-ai.api.test.ts: a field 1, a
  // nullable field 2, an object 1 plus its fields, an array 2 plus its items,
  // a reference 1 and each shared definition once. This reads 2-3 higher than
  // the API measured; the API rejected schemas from an estimate of about 75.
  function estimateGrammar(schema: JsonSchema): number {
    const node = (item: JsonSchema): number => {
      if (item.$ref) return 1;
      const own = Array.isArray(item.type) ? 2 : 1;
      if (item.type === "object") return own + Object.values(item.properties ?? {}).reduce((sum, p) => sum + node(p), 0);
      if (item.type === "array" && item.items) return own + 1 + node(item.items);
      return own;
    };
    const defs = Object.values(schema.$defs ?? {}).reduce((sum, def) => sum + node(def), 0);
    // The root object itself isn't counted.
    return node(schema) - 1 + defs;
  }

  const schemas = async () => {
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const ai = await import("@/lib/server/recipe-ai");
    return [ai.ExtractedRecipeSchema, ai.RefinedRecipeSchema, ai.RecalculatedRecipeSchema].map(
      (schema) => zodOutputFormat(schema).schema as JsonSchema,
    );
  };

  // The API rejects a request whose output schema has more than 16 union-typed
  // fields ("Parameters with union types" in the structured outputs limits).
  it("stay within the API's limit on nullable fields", async () => {
    for (const schema of await schemas()) expect(countUnions(schema)).toBeLessThanOrEqual(16);
  });

  // "The compiled grammar is too large": the limit isn't published, so this
  // keeps some distance to where the API started rejecting the schemas.
  it("stay well below the API's limit on grammar size", async () => {
    for (const schema of await schemas()) expect(estimateGrammar(schema)).toBeLessThanOrEqual(68);
  });

  it("treats 0 minutes as no time", () => {
    const draft = toRecipeDraft({ ...base, active_minutes: 0, total_minutes: 0 });
    expect(draft.prep_time).toBe("");
    expect(draft.details?.total_minutes).toBeNull();
  });
});
