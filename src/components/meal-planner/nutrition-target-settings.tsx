"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import { queryKeys, useUserId } from "@/hooks/use-planner-data";
import type { UserPreferences } from "@/types/database";
import { Switch } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
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

type TargetKey = "calories" | "protein" | "carbs" | "fats";

const TARGET_FIELDS: { key: TargetKey; label: string; unit: string; step: number; max: number }[] = [
  { key: "calories", label: "Kalorien", unit: "kcal", step: 50, max: 9950 },
  { key: "protein", label: "Protein", unit: "g", step: 5, max: 995 },
  { key: "carbs", label: "Carbs", unit: "g", step: 5, max: 995 },
  { key: "fats", label: "Fett", unit: "g", step: 5, max: 995 },
];

const SAVE_DELAY_MS = 600;

interface NutritionTargetsScreenProps {
  targets: NutritionTargetSettings;
  onBack: () => void;
  onChange: (targets: NutritionTargetSettings) => void;
}

/**
 * Daily targets with +/- steppers and on/off switches. Changes save by
 * themselves shortly after the last tap; leaving the screen saves right away.
 */
export function NutritionTargetsScreen({ targets, onBack, onChange }: NutritionTargetsScreenProps) {
  const [settings, setSettings] = useState<NutritionTargetSettings>(targets);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const pendingRef = useRef<NutritionTargetSettings | null>(null);
  const timerRef = useRef<number | null>(null);

  const save = useCallback(async () => {
    const next = pendingRef.current;
    if (!next) return;
    pendingRef.current = null;
    setSaveState("saving");

    try {
      const user = await getSessionUser();
      if (!user) throw new Error("Nicht angemeldet");

      const { error } = await createClient()
        .from("user_preferences")
        .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });

      if (error) throw error;
      setSaveState("saved");
    } catch (err) {
      console.error(err);
      setSaveState("idle");
      toast.error("Ziele konnten nicht gespeichert werden");
    }
  }, []);

  // Save whatever is still waiting when the screen closes.
  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      void save();
    },
    [save],
  );

  const update = (patch: Partial<NutritionTargetSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    onChange(next);
    pendingRef.current = next;
    setSaveState("saving");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void save(), SAVE_DELAY_MS);
  };

  return (
    <SubPage
      title="Tagesziele"
      tone="muted"
      onBack={onBack}
      description="Der Planer zeigt, wie viel davon jeden Tag noch frei ist. Ausgeschaltete Ziele werden nicht angezeigt."
      footer={
        <p
          aria-live="polite"
          className="flex h-6 items-center justify-center gap-1.5 text-[13px] font-semibold text-brand-accent-dark"
        >
          {saveState === "saving" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Speichert …
            </>
          ) : (
            <>
              <Check className="size-3.5" strokeWidth={3} />
              {saveState === "saved" ? "Gespeichert" : "Speichert automatisch"}
            </>
          )}
        </p>
      }
    >
      <div className="space-y-3">
        {TARGET_FIELDS.map(({ key, label, unit, step, max }) => {
          const valueKey = `${key}_target` as const;
          const enabledKey = `${key}_target_enabled` as const;
          const value = settings[valueKey];
          const enabled = settings[enabledKey];
          const setValue = (next: number) =>
            update({ [valueKey]: Math.min(Math.max(Math.round(next), 0), max) });

          return (
            <section
              key={key}
              className={cn(
                "space-y-3 rounded-[18px] bg-white p-3.5 ring-1 ring-brand-card-border transition-opacity",
                !enabled && "opacity-60",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-brand-ink">{label}</span>
                <Switch
                  checked={enabled}
                  onChange={(checked) => update({ [enabledKey]: checked })}
                  label={`${label} anzeigen`}
                />
              </div>
              <div className="flex items-center gap-2.5">
                <StepButton
                  label={`${label} verringern`}
                  disabled={!enabled}
                  onClick={() => setValue(value - step)}
                >
                  <Minus className="size-4" strokeWidth={3} />
                </StepButton>
                <label className="flex flex-1 items-baseline justify-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={value.toLocaleString("de-DE")}
                    disabled={!enabled}
                    onChange={(event) => setValue(Number(event.target.value.replace(/\D/g, "")) || 0)}
                    aria-label={`${label} in ${unit}`}
                    className="w-28 bg-transparent text-right font-heading text-[28px] font-extrabold text-brand-ink outline-none"
                  />
                  <span className="w-12 text-[15px] font-semibold text-brand-secondary">{unit}</span>
                </label>
                <StepButton
                  label={`${label} erhöhen`}
                  disabled={!enabled}
                  onClick={() => setValue(value + step)}
                >
                  <Plus className="size-4" strokeWidth={3} />
                </StepButton>
              </div>
            </section>
          );
        })}
      </div>
    </SubPage>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-xl bg-brand-chip-neutral text-brand-ink transition-transform active:scale-90 active:bg-brand-accent-bg disabled:active:scale-100"
    >
      {children}
    </button>
  );
}
