"use client";

import { useEffect, useState } from "react";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DEFAULT_FOOD_ITEM_TAGS,
  FoodItemFields,
  type FoodItemTagValues,
} from "./food-item-fields";
import type { FoodItem } from "@/types/database";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export type IngredientRow = {
  rowId: string;
  foodItemId: string | null;
  foodItemName: string;
  quantity: string;
  unit: string;
};

let rowIdCounter = 0;

export function createEmptyIngredientRow(): IngredientRow {
  rowIdCounter += 1;
  return {
    rowId: `row-${Date.now()}-${rowIdCounter}`,
    foodItemId: null,
    foodItemName: "",
    quantity: "1",
    unit: "",
  };
}

interface RecipeIngredientEditorProps {
  rows: IngredientRow[];
  onChange: (rows: IngredientRow[]) => void;
}

export function RecipeIngredientEditor({ rows, onChange }: RecipeIngredientEditorProps) {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [isQuickAdd, setIsQuickAdd] = useState(false);
  const [quickAddTags, setQuickAddTags] = useState<FoodItemTagValues>(DEFAULT_FOOD_ITEM_TAGS);
  const [isSavingQuickAdd, setIsSavingQuickAdd] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const loadFoodItems = async () => {
      const user = await getSessionUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("food_items")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) {
        toast.error("Lebensmitteldatenbank konnte nicht geladen werden");
        return;
      }

      setFoodItems((data ?? []) as FoodItem[]);
    };

    loadFoodItems();
  }, []);

  const updateRow = (rowId: string, updates: Partial<IngredientRow>) => {
    onChange(rows.map((row) => (row.rowId === rowId ? { ...row, ...updates } : row)));
  };

  const removeRow = (rowId: string) => {
    onChange(rows.filter((row) => row.rowId !== rowId));
  };

  const openPopoverForRow = (row: IngredientRow) => {
    setOpenRowId(row.rowId);
    setSearchText(row.foodItemName);
    setIsQuickAdd(false);
    setQuickAddTags(DEFAULT_FOOD_ITEM_TAGS);
  };

  const closePopover = () => {
    setOpenRowId(null);
    setIsQuickAdd(false);
  };

  const handleSelectFoodItem = (rowId: string, foodItem: FoodItem) => {
    updateRow(rowId, { foodItemId: foodItem.id, foodItemName: foodItem.name });
    closePopover();
  };

  const handleSaveQuickAdd = async (rowId: string) => {
    const name = searchText.trim();
    if (!name) return;

    setIsSavingQuickAdd(true);

    try {
      const user = await getSessionUser();

      if (!user) {
        toast.error("Du musst angemeldet sein");
        return;
      }

      const { data, error } = await supabase
        .from("food_items")
        .insert({ user_id: user.id, name, ...quickAddTags } as never)
        .select("*")
        .single();

      if (error) {
        toast.error(error.message || "Lebensmittel konnte nicht erstellt werden");
        return;
      }

      const newFoodItem = data as FoodItem;
      setFoodItems((prev) =>
        [...prev, newFoodItem].sort((a, b) => a.name.localeCompare(b.name)),
      );
      updateRow(rowId, { foodItemId: newFoodItem.id, foodItemName: newFoodItem.name });
      closePopover();
      toast.success(`"${newFoodItem.name}" zur Lebensmitteldatenbank hinzugefügt`);
    } finally {
      setIsSavingQuickAdd(false);
    }
  };

  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredFoodItems = normalizedSearch
    ? foodItems.filter((item) => item.name.toLowerCase().includes(normalizedSearch))
    : foodItems;
  const hasExactMatch = foodItems.some(
    (item) => item.name.toLowerCase() === normalizedSearch,
  );

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.rowId} className="grid grid-cols-[1fr_72px_88px_auto] items-center gap-2">
          <Popover
            open={openRowId === row.rowId}
            onOpenChange={(open) => (open ? openPopoverForRow(row) : closePopover())}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full justify-start font-normal"
              >
                {row.foodItemName || "Lebensmittel wählen..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3">
              {isQuickAdd ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    &ldquo;{searchText.trim()}&rdquo; erstellen
                  </p>
                  <FoodItemFields
                    value={quickAddTags}
                    onChange={setQuickAddTags}
                    idPrefix={`quick-add-${row.rowId}`}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsQuickAdd(false)}
                    >
                      Zurück
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingQuickAdd || !searchText.trim()}
                      onClick={() => handleSaveQuickAdd(row.rowId)}
                    >
                      {isSavingQuickAdd ? "Wird gespeichert..." : "Erstellen & verwenden"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Lebensmittel suchen..."
                    className="h-8"
                  />
                  <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                    {filteredFoodItems.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectFoodItem(row.rowId, item)}
                          className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-brand-chip-neutral"
                        >
                          {item.name}
                        </button>
                      </li>
                    ))}
                    {filteredFoodItems.length === 0 && (
                      <li className="px-2 py-1.5 text-sm text-brand-tertiary">Keine Treffer</li>
                    )}
                  </ul>
                  {searchText.trim() && !hasExactMatch && (
                    <button
                      type="button"
                      onClick={() => setIsQuickAdd(true)}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-brand-accent-dark hover:bg-brand-accent-bg"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      &ldquo;{searchText.trim()}&rdquo; erstellen
                    </button>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Input
            type="number"
            step="0.1"
            min="0"
            value={row.quantity}
            onChange={(event) => updateRow(row.rowId, { quantity: event.target.value })}
            className="h-9"
          />

          <Input
            value={row.unit}
            onChange={(event) => updateRow(row.rowId, { unit: event.target.value })}
            placeholder="Einheit"
            className="h-9"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => removeRow(row.rowId)}
            aria-label="Zutat entfernen"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, createEmptyIngredientRow()])}
      >
        <Plus className="mr-1 h-4 w-4" />
        Zutat hinzufügen
      </Button>
    </div>
  );
}
