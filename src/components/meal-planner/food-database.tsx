"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DEFAULT_FOOD_ITEM_TAGS,
  FOOD_COLOR_OPTIONS,
  FoodItemFields,
  type FoodItemTagValues,
} from "./food-item-fields";
import { parseFoodImportText } from "@/lib/food-import";
import type { FoodItem } from "@/types/database";
import { Pencil, Plus, Salad, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";

const IMPORT_PLACEHOLDER = `Süßkartoffel (Plant=true;Legume=false;Fermented=false;Whole grain=false;Added sugar=false;Processed=false;Color=red)
Whey Protein (Plant=false;Legume=false;Fermented=false;Whole grain=false;Added sugar=true;Processed=true)`;

const TAG_LABELS: { key: keyof FoodItemTagValues; label: string }[] = [
  { key: "is_plant", label: "Pflanzlich" },
  { key: "is_legume", label: "Hülsenfrucht" },
  { key: "is_fermented", label: "Fermentiert" },
  { key: "is_whole_grain", label: "Vollkorn" },
  { key: "has_added_sugar", label: "Zugesetzter Zucker" },
  { key: "is_processed", label: "Verarbeitet" },
];

function FoodItemBadges({ foodItem }: { foodItem: FoodItem }) {
  const colorOption = FOOD_COLOR_OPTIONS.find((option) => option.value === foodItem.color);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colorOption && (
        <span
          className={`size-3 rounded-full ${colorOption.swatchClassName}`}
          title={colorOption.label}
        />
      )}
      {TAG_LABELS.filter(({ key }) => foodItem[key] === true).map(({ key, label }) => (
        <Badge key={key} variant="outline" className="rounded-full">
          {label}
        </Badge>
      ))}
    </div>
  );
}

export function FoodDatabase() {
  const [isOpen, setIsOpen] = useState(false);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFoodItem, setEditingFoodItem] = useState<FoodItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formTags, setFormTags] = useState<FoodItemTagValues>(DEFAULT_FOOD_ITEM_TAGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const supabase = createClient();

  const fetchFoodItems = async () => {
    setLoading(true);

    try {
      const user = await getSessionUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("food_items")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) throw error;

      setFoodItems((data ?? []) as FoodItem[]);
    } catch {
      toast.error("Lebensmitteldatenbank konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFoodItems();
    }
  }, [isOpen]);

  const filteredFoodItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return foodItems;
    }

    return foodItems.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
  }, [foodItems, searchQuery]);

  const openCreateForm = () => {
    setEditingFoodItem(null);
    setFormName("");
    setFormTags(DEFAULT_FOOD_ITEM_TAGS);
    setIsFormOpen(true);
  };

  const openEditForm = (foodItem: FoodItem) => {
    setEditingFoodItem(foodItem);
    setFormName(foodItem.name);
    setFormTags({
      is_plant: foodItem.is_plant,
      is_legume: foodItem.is_legume,
      is_fermented: foodItem.is_fermented,
      is_whole_grain: foodItem.is_whole_grain,
      has_added_sugar: foodItem.has_added_sugar,
      is_processed: foodItem.is_processed,
      color: foodItem.color,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingFoodItem(null);
  };

  const openImportForm = () => {
    setImportText("");
    setImportWarnings([]);
    setIsImportOpen(true);
  };

  const closeImportForm = () => {
    setIsImportOpen(false);
    setImportText("");
    setImportWarnings([]);
  };

  const handleImport = async () => {
    const { items, warnings } = parseFoodImportText(importText);

    if (items.length === 0) {
      setImportWarnings(warnings.length > 0 ? warnings : ["Keine gültigen Lebensmittel gefunden"]);
      return;
    }

    setIsImporting(true);

    try {
      const user = await getSessionUser();

      if (!user) {
        toast.error("Du musst angemeldet sein");
        return;
      }

      const { error } = await supabase
        .from("food_items")
        .upsert(
          items.map((item) => ({ user_id: user.id, ...item })) as never,
          { onConflict: "user_id,name" },
        );

      if (error) throw error;

      toast.success(
        `${items.length} Lebensmittel importiert`,
      );
      setImportWarnings(warnings);

      if (warnings.length === 0) {
        closeImportForm();
      }

      await fetchFoodItems();
    } catch (err: any) {
      toast.error(err?.message || "Lebensmittel konnten nicht importiert werden");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSave = async () => {
    const name = formName.trim();

    if (!name) {
      toast.error("Name ist erforderlich");
      return;
    }

    setIsSaving(true);

    try {
      const user = await getSessionUser();

      if (!user) {
        toast.error("Du musst angemeldet sein");
        return;
      }

      if (editingFoodItem) {
        const { error } = await supabase
          .from("food_items")
          .update({ name, ...formTags } as never)
          .eq("id", editingFoodItem.id)
          .eq("user_id", user.id);

        if (error) throw error;

        toast.success("Lebensmittel aktualisiert");
      } else {
        const { error } = await supabase
          .from("food_items")
          .insert({ user_id: user.id, name, ...formTags } as never);

        if (error) throw error;

        toast.success("Lebensmittel hinzugefügt");
      }

      closeForm();
      await fetchFoodItems();
    } catch (err: any) {
      toast.error(err?.message || "Lebensmittel konnte nicht gespeichert werden");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (foodItem: FoodItem) => {
    try {
      const { error } = await supabase.from("food_items").delete().eq("id", foodItem.id);

      if (error) {
        if (error.code === "23503") {
          toast.error(`"${foodItem.name}" wird in einem Rezept verwendet und kann nicht gelöscht werden`);
          return;
        }

        throw error;
      }

      setFoodItems((prev) => prev.filter((item) => item.id !== foodItem.id));
      toast.success("Lebensmittel gelöscht");
    } catch {
      toast.error("Lebensmittel konnte nicht gelöscht werden");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Salad className="mr-1.5 h-4 w-4" />
          Lebensmittel
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-h-[85vh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lebensmitteldatenbank</DialogTitle>
        </DialogHeader>

        {isFormOpen ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="food-name">Name</Label>
              <Input
                id="food-name"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                placeholder="z. B. Haferflocken"
                autoFocus
              />
            </div>

            <FoodItemFields value={formTags} onChange={setFormTags} idPrefix="food-db-form" />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeForm}>
                Abbrechen
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Wird gespeichert..." : "Speichern"}
              </Button>
            </div>
          </div>
        ) : isImportOpen ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="food-import">
                Ein Lebensmittel pro Zeile: <code>Name (Plant=true;Legume=false;...)</code>
              </Label>
              <Textarea
                id="food-import"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder={IMPORT_PLACEHOLDER}
                className="h-40 font-mono text-xs"
                autoFocus
              />
              <p className="text-xs text-brand-tertiary">
                Erkannte Attribute: Plant, Legume, Fermented, Whole grain, Added sugar,
                Processed (true/false) und Color (red/yellow/green/purple/brown). Der Import
                eines bereits vorhandenen Namens aktualisiert diesen. Unbekannte Attribute oder
                Farben werden mit einer Warnung übersprungen, nicht blockiert.
              </p>
            </div>

            {importWarnings.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                <ul className="list-inside list-disc space-y-0.5">
                  {importWarnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeImportForm}>
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={isImporting || !importText.trim()}
              >
                {isImporting ? "Wird importiert..." : "Importieren"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Lebensmittel suchen..."
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={openImportForm}
                aria-label="Lebensmittel schnell importieren"
                title="Lebensmittel schnell importieren"
              >
                <Upload className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="outline" onClick={openCreateForm}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-brand-tertiary">Wird geladen...</p>
            ) : filteredFoodItems.length === 0 ? (
              <p className="text-sm text-brand-tertiary">Noch keine Lebensmittel vorhanden.</p>
            ) : (
              <ul className="space-y-2">
                {filteredFoodItems.map((foodItem) => (
                  <li
                    key={foodItem.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-brand-card-border p-3"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <p className="truncate text-sm font-medium text-brand-ink">
                        {foodItem.name}
                      </p>
                      <FoodItemBadges foodItem={foodItem} />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEditForm(foodItem)}
                        aria-label={`${foodItem.name} bearbeiten`}
                      >
                        <Pencil className="h-4 w-4 text-brand-tertiary" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(foodItem)}
                        aria-label={`${foodItem.name} löschen`}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
