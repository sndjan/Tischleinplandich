"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import { queryKeys, useUserId } from "@/hooks/use-planner-data";
import type { UserPreferences } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";
import { SubPage } from "./sub-page";

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

/**
 * Loads the user's saved nutrition targets, falling back to the defaults.
 */
export function useNutritionTargets() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.nutritionTargets(userId ?? "");

  const { data } = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data: preferencesData, error } = await createClient()
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) {
        toast.error("Ziele konnten nicht geladen werden");
        throw error;
      }

      return toNutritionTargets(preferencesData);
    },
  });

  const setTargets = useCallback(
    (targets: NutritionTargetSettings) => queryClient.setQueryData(queryKey, targets),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, userId],
  );

  return [data ?? DEFAULT_NUTRITION_TARGETS, setTargets] as const;
}

interface NutritionTargetsScreenProps {
  targets: NutritionTargetSettings;
  onBack: () => void;
  onSaved: (targets: NutritionTargetSettings) => void;
}

export function NutritionTargetsScreen({
  targets,
  onBack,
  onSaved,
}: NutritionTargetsScreenProps) {
  const [targetSettings, setTargetSettings] =
    useState<NutritionTargetSettings>(targets);
  const [isSavingTargets, setIsSavingTargets] = useState(false);
  const supabase = createClient();

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
        toast.error("Nicht angemeldet");
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

      toast.success("Ziele gespeichert");
      onSaved(toNutritionTargets(data));
    } catch (err) {
      console.error(err);
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setIsSavingTargets(false);
    }
  };

  return (
    <SubPage
      title="Ziele"
      description="Pro Tag"
      onBack={onBack}
      footer={
        <Button
          className="w-full"
          onClick={handleSaveTargets}
          disabled={isSavingTargets}
        >
          {isSavingTargets ? "Speichert…" : "Speichern"}
        </Button>
      }
    >
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
            <Label htmlFor="carbs-target">Carbs (g)</Label>
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
    </SubPage>
  );
}
