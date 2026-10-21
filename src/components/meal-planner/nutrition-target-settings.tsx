"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import type { HealthTargets, UserPreferences } from "@/types/database";
import { DEFAULT_HEALTH_TARGETS, type HealthTargetValues } from "@/lib/health-metrics";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";

export type NutritionTargetSettings = {
  calories_target: number;
  protein_target: number;
  carbs_target: number;
  fats_target: number;
  calories_target_enabled: boolean;
  protein_target_enabled: boolean;
  carbs_target_enabled: boolean;
  fats_target_enabled: boolean;
};

export const DEFAULT_NUTRITION_TARGETS: NutritionTargetSettings = {
  calories_target: 2000,
  protein_target: 150,
  carbs_target: 250,
  fats_target: 70,
  calories_target_enabled: true,
  protein_target_enabled: true,
  carbs_target_enabled: true,
  fats_target_enabled: true,
};

const toNutritionTargets = (
  preferences?: Partial<UserPreferences> | null,
): NutritionTargetSettings => ({
  calories_target: Number(
    preferences?.calories_target ?? DEFAULT_NUTRITION_TARGETS.calories_target,
  ),
  protein_target: Number(
    preferences?.protein_target ?? DEFAULT_NUTRITION_TARGETS.protein_target,
  ),
  carbs_target: Number(
    preferences?.carbs_target ?? DEFAULT_NUTRITION_TARGETS.carbs_target,
  ),
  fats_target: Number(
    preferences?.fats_target ?? DEFAULT_NUTRITION_TARGETS.fats_target,
  ),
  calories_target_enabled: Boolean(
    preferences?.calories_target_enabled ??
    DEFAULT_NUTRITION_TARGETS.calories_target_enabled,
  ),
  protein_target_enabled: Boolean(
    preferences?.protein_target_enabled ??
    DEFAULT_NUTRITION_TARGETS.protein_target_enabled,
  ),
  carbs_target_enabled: Boolean(
    preferences?.carbs_target_enabled ??
    DEFAULT_NUTRITION_TARGETS.carbs_target_enabled,
  ),
  fats_target_enabled: Boolean(
    preferences?.fats_target_enabled ??
    DEFAULT_NUTRITION_TARGETS.fats_target_enabled,
  ),
});

const toHealthTargetValues = (
  healthTargets?: Partial<HealthTargets> | null,
): HealthTargetValues => ({
  plant_diversity_target: Number(
    healthTargets?.plant_diversity_target ?? DEFAULT_HEALTH_TARGETS.plant_diversity_target,
  ),
  fermented_min: Number(
    healthTargets?.fermented_min ?? DEFAULT_HEALTH_TARGETS.fermented_min,
  ),
  fermented_max: Number(
    healthTargets?.fermented_max ?? DEFAULT_HEALTH_TARGETS.fermented_max,
  ),
  legume_min: Number(healthTargets?.legume_min ?? DEFAULT_HEALTH_TARGETS.legume_min),
  legume_max: Number(healthTargets?.legume_max ?? DEFAULT_HEALTH_TARGETS.legume_max),
  whole_grain_target_pct: Number(
    healthTargets?.whole_grain_target_pct ?? DEFAULT_HEALTH_TARGETS.whole_grain_target_pct,
  ),
  added_sugar_max_meals: Number(
    healthTargets?.added_sugar_max_meals ?? DEFAULT_HEALTH_TARGETS.added_sugar_max_meals,
  ),
  unprocessed_target_pct: Number(
    healthTargets?.unprocessed_target_pct ?? DEFAULT_HEALTH_TARGETS.unprocessed_target_pct,
  ),
  color_diversity_target: Number(
    healthTargets?.color_diversity_target ?? DEFAULT_HEALTH_TARGETS.color_diversity_target,
  ),
});

interface NutritionTargetSettingsProps {
  onTargetsChange?: (targets: NutritionTargetSettings) => void;
  onHealthTargetsChange?: (targets: HealthTargetValues) => void;
}

export function NutritionTargetSettings({
  onTargetsChange,
  onHealthTargetsChange,
}: NutritionTargetSettingsProps) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [targetSettings, setTargetSettings] = useState<NutritionTargetSettings>(
    DEFAULT_NUTRITION_TARGETS,
  );
  const [healthTargetsRow, setHealthTargetsRow] = useState<HealthTargets | null>(null);
  const [healthTargetSettings, setHealthTargetSettings] = useState<HealthTargetValues>(
    toHealthTargetValues(),
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavingTargets, setIsSavingTargets] = useState(false);
  const supabase = createClient();

  const activeTargets = useMemo(
    () =>
      preferences ? toNutritionTargets(preferences) : DEFAULT_NUTRITION_TARGETS,
    [preferences],
  );

  const activeHealthTargets = useMemo(
    () =>
      healthTargetsRow ? toHealthTargetValues(healthTargetsRow) : toHealthTargetValues(),
    [healthTargetsRow],
  );

  useEffect(() => {
    onTargetsChange?.(activeTargets);
  }, [activeTargets, onTargetsChange]);

  useEffect(() => {
    onHealthTargetsChange?.(activeHealthTargets);
  }, [activeHealthTargets, onHealthTargetsChange]);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const user = await getSessionUser();

        if (!user) {
          setPreferences(null);
          setTargetSettings(DEFAULT_NUTRITION_TARGETS);
          setHealthTargetsRow(null);
          setHealthTargetSettings(toHealthTargetValues());
          return;
        }

        const { data: preferencesData } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (preferencesData) {
          setPreferences(preferencesData);
          setTargetSettings(toNutritionTargets(preferencesData));
        } else {
          setPreferences(null);
          setTargetSettings(DEFAULT_NUTRITION_TARGETS);
        }

        const { data: healthTargetsData } = await supabase
          .from("health_targets")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (healthTargetsData) {
          setHealthTargetsRow(healthTargetsData);
          setHealthTargetSettings(toHealthTargetValues(healthTargetsData));
        } else {
          setHealthTargetsRow(null);
          setHealthTargetSettings(toHealthTargetValues());
        }
      } catch (err) {
        console.error(err);
        toast.error("Ernährungsziele konnten nicht geladen werden");
      }
    };

    loadPreferences();
  }, [supabase]);

  const handleHealthTargetChange = (field: keyof HealthTargetValues, value: string) => {
    const parsedValue = Number(value);

    setHealthTargetSettings((prev) => ({
      ...prev,
      [field]: Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0,
    }));
  };

  const handleTargetToggle = (
    field: keyof NutritionTargetSettings,
    checked: boolean,
  ) => {
    setTargetSettings((prev) => ({
      ...prev,
      [field]: checked,
    }));
  };

  const handleTargetValueChange = (
    field: keyof NutritionTargetSettings,
    value: string,
  ) => {
    const parsedValue = Number(value);

    setTargetSettings((prev) => ({
      ...prev,
      [field]:
        Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0,
    }));
  };

  const handleSaveTargets = async () => {
    try {
      setIsSavingTargets(true);

      const user = await getSessionUser();

      if (!user) {
        toast.error("Du musst angemeldet sein, um Ziele zu speichern");
        return;
      }

      const payload = {
        user_id: user.id,
        calories_target: targetSettings.calories_target,
        protein_target: targetSettings.protein_target,
        carbs_target: targetSettings.carbs_target,
        fats_target: targetSettings.fats_target,
        calories_target_enabled: targetSettings.calories_target_enabled,
        protein_target_enabled: targetSettings.protein_target_enabled,
        carbs_target_enabled: targetSettings.carbs_target_enabled,
        fats_target_enabled: targetSettings.fats_target_enabled,
      };

      const { data, error } = await supabase
        .from("user_preferences")
        .upsert(payload, { onConflict: "user_id" })
        .select("*")
        .single();

      if (error) throw error;

      const healthPayload = {
        user_id: user.id,
        ...healthTargetSettings,
      };

      const { data: healthData, error: healthError } = await supabase
        .from("health_targets")
        .upsert(healthPayload, { onConflict: "user_id" })
        .select("*")
        .single();

      if (healthError) throw healthError;

      setPreferences(data);
      setHealthTargetsRow(healthData);
      setIsSettingsOpen(false);
      toast.success("Ziele gespeichert");
    } catch (err) {
      console.error(err);
      toast.error("Ernährungsziele konnten nicht gespeichert werden");
    } finally {
      setIsSavingTargets(false);
    }
  };

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-brand-accent-dark">
          <Settings2 className="mr-1.5 h-4 w-4" />
          Ziele
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ziele</DialogTitle>
          <DialogDescription>
            Lege deine täglichen Ernährungsziele und wöchentlichen Health-Card-Ziele fest.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="calories-target">Kalorien</Label>
              <Input
                id="calories-target"
                type="number"
                min="0"
                value={targetSettings.calories_target}
                disabled={!targetSettings.calories_target_enabled}
                onChange={(e) =>
                  handleTargetValueChange("calories_target", e.target.value)
                }
              />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <Checkbox
                id="calories-enabled"
                checked={targetSettings.calories_target_enabled}
                onCheckedChange={(checked) =>
                  handleTargetToggle(
                    "calories_target_enabled",
                    checked === true,
                  )
                }
              />
              <Label htmlFor="calories-enabled">Aktiv</Label>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="protein-target">Protein (g)</Label>
              <Input
                id="protein-target"
                type="number"
                min="0"
                value={targetSettings.protein_target}
                disabled={!targetSettings.protein_target_enabled}
                onChange={(e) =>
                  handleTargetValueChange("protein_target", e.target.value)
                }
              />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <Checkbox
                id="protein-enabled"
                checked={targetSettings.protein_target_enabled}
                onCheckedChange={(checked) =>
                  handleTargetToggle("protein_target_enabled", checked === true)
                }
              />
              <Label htmlFor="protein-enabled">Aktiv</Label>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="carbs-target">Kohlenhydrate (g)</Label>
              <Input
                id="carbs-target"
                type="number"
                min="0"
                value={targetSettings.carbs_target}
                disabled={!targetSettings.carbs_target_enabled}
                onChange={(e) =>
                  handleTargetValueChange("carbs_target", e.target.value)
                }
              />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <Checkbox
                id="carbs-enabled"
                checked={targetSettings.carbs_target_enabled}
                onCheckedChange={(checked) =>
                  handleTargetToggle("carbs_target_enabled", checked === true)
                }
              />
              <Label htmlFor="carbs-enabled">Aktiv</Label>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="space-y-1">
              <Label htmlFor="fats-target">Fett (g)</Label>
              <Input
                id="fats-target"
                type="number"
                min="0"
                value={targetSettings.fats_target}
                disabled={!targetSettings.fats_target_enabled}
                onChange={(e) =>
                  handleTargetValueChange("fats_target", e.target.value)
                }
              />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <Checkbox
                id="fats-enabled"
                checked={targetSettings.fats_target_enabled}
                onCheckedChange={(checked) =>
                  handleTargetToggle("fats_target_enabled", checked === true)
                }
              />
              <Label htmlFor="fats-enabled">Aktiv</Label>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-brand-card-border pt-4">
          <div>
            <h3 className="text-sm font-medium">Wöchentliche Health-Ziele</h3>
            <p className="text-xs text-brand-tertiary">
              Ziele für die Health-Card-Kennzahlen, basierend auf den für diese Woche geplanten Mahlzeiten.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="plant-diversity-target">Pflanzenvielfalt (einzigartig)</Label>
              <Input
                id="plant-diversity-target"
                type="number"
                min="0"
                value={healthTargetSettings.plant_diversity_target}
                onChange={(e) =>
                  handleHealthTargetChange("plant_diversity_target", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="color-diversity-target">Farbvielfalt (Farben)</Label>
              <Input
                id="color-diversity-target"
                type="number"
                min="0"
                max="5"
                value={healthTargetSettings.color_diversity_target}
                onChange={(e) =>
                  handleHealthTargetChange("color_diversity_target", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="fermented-min">Fermentiert min (Mahlzeiten/Woche)</Label>
              <Input
                id="fermented-min"
                type="number"
                min="0"
                value={healthTargetSettings.fermented_min}
                onChange={(e) => handleHealthTargetChange("fermented_min", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="fermented-max">Fermentiert max (Mahlzeiten/Woche)</Label>
              <Input
                id="fermented-max"
                type="number"
                min="0"
                value={healthTargetSettings.fermented_max}
                onChange={(e) => handleHealthTargetChange("fermented_max", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="legume-min">Hülsenfrüchte min (Mahlzeiten/Woche)</Label>
              <Input
                id="legume-min"
                type="number"
                min="0"
                value={healthTargetSettings.legume_min}
                onChange={(e) => handleHealthTargetChange("legume_min", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="legume-max">Hülsenfrüchte max (Mahlzeiten/Woche)</Label>
              <Input
                id="legume-max"
                type="number"
                min="0"
                value={healthTargetSettings.legume_max}
                onChange={(e) => handleHealthTargetChange("legume_max", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="whole-grain-target">Vollkorn-Ziel (%)</Label>
              <Input
                id="whole-grain-target"
                type="number"
                min="0"
                max="100"
                value={healthTargetSettings.whole_grain_target_pct}
                onChange={(e) =>
                  handleHealthTargetChange("whole_grain_target_pct", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="unprocessed-target">Unverarbeitet-Ziel (%)</Label>
              <Input
                id="unprocessed-target"
                type="number"
                min="0"
                max="100"
                value={healthTargetSettings.unprocessed_target_pct}
                onChange={(e) =>
                  handleHealthTargetChange("unprocessed_target_pct", e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="added-sugar-max">Zugesetzter Zucker max (Mahlzeiten/Woche)</Label>
              <Input
                id="added-sugar-max"
                type="number"
                min="0"
                value={healthTargetSettings.added_sugar_max_meals}
                onChange={(e) =>
                  handleHealthTargetChange("added_sugar_max_meals", e.target.value)
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSaveTargets} disabled={isSavingTargets}>
            {isSavingTargets ? "Wird gespeichert..." : "Ziele speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
