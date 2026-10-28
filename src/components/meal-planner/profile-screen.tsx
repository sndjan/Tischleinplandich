"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, LogOut, Pencil } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";
import { isStandalone, promptInstall } from "@/lib/install-prompt";
import { queryKeys, useProfileQuery, useRecipesQuery, useUserId } from "@/hooks/use-planner-data";
import { DAILY_AI_LIMIT } from "@/lib/recipe-draft";
import { exportRecipesAsZip } from "@/lib/recipe-export";
import { cn } from "@/lib/utils";
import { CACHE_STORAGE_KEY } from "@/lib/query-provider";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { NutritionTargetSettings } from "./nutrition-target-settings";
import { SubPage } from "./sub-page";
import { useHasUnseenChanges } from "./whats-new-screen";
import { useScreenStack } from "./screen-stack";

const formatNumber = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 0 });

export function describeTargets(targets: NutritionTargetSettings) {
  if (!targets.show_nutrition) return "Nährwerte ausgeblendet";
  const parts = [
    targets.calories_target_enabled && `${formatNumber(targets.calories_target)} kcal`,
    targets.protein_target_enabled && `${formatNumber(targets.protein_target)} g Protein`,
    targets.carbs_target_enabled && `${formatNumber(targets.carbs_target)} g Carbs`,
    targets.fats_target_enabled && `${formatNumber(targets.fats_target)} g Fett`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.slice(0, 2).join(" · ") : "Keine Ziele aktiv";
}

export function profileInitial(displayName: string | null | undefined, email: string | null | undefined) {
  return (displayName || email || "?").trim().charAt(0).toUpperCase();
}

/**
 * Saves the name shown on shared recipes. Resolves false when the database
 * doesn't have the column yet (migration 011 missing).
 */
export function useSaveDisplayName() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return async (name: string) => {
    if (!userId) return false;
    const displayName = name.trim().slice(0, 40) || null;
    const { error } = await createClient()
      .from("users")
      .update({ display_name: displayName })
      .eq("id", userId);

    if (error) {
      console.error(error);
      toast.error("Name konnte nicht gespeichert werden");
      return false;
    }

    queryClient.setQueryData(queryKeys.profile(userId), { displayName, sharingReady: true });
    return true;
  };
}

/**
 * Today's AI requests. Null until migration 010 (ai_usage) exists; without it
 * no limit applies, so there is nothing to show.
 */
function useAiUsageToday() {
  const userId = useUserId();

  return useQuery({
    queryKey: ["ai-usage", userId ?? ""],
    enabled: Boolean(userId),
    staleTime: 0,
    queryFn: async (): Promise<number | null> => {
      // The database counts per UTC day (CURRENT_DATE).
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await createClient()
        .from("ai_usage")
        .select("request_count")
        .eq("user_id", userId!)
        .eq("usage_date", today)
        .maybeSingle();

      if (error) return null;
      return data?.request_count ?? 0;
    },
  });
}

function useExportRecipes() {
  const { data } = useRecipesQuery();
  const [exporting, setExporting] = useState(false);

  const run = async () => {
    const recipes = data?.recipes ?? [];
    if (recipes.length === 0) {
      toast("Noch keine Rezepte zum Exportieren");
      return;
    }

    setExporting(true);
    try {
      const zip = await exportRecipesAsZip(recipes, data?.tagsById ?? {});
      const url = URL.createObjectURL(zip);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rezepte-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success(`${recipes.length} ${recipes.length === 1 ? "Rezept" : "Rezepte"} exportiert`);
    } catch (error) {
      console.error(error);
      toast.error("Export hat nicht geklappt");
    } finally {
      setExporting(false);
    }
  };

  return { exporting, run, count: data?.recipes.length ?? 0 };
}

interface ProfileScreenProps {
  targets: NutritionTargetSettings;
  pantryStaples: string[];
  onFeedback: () => void;
  onBack: () => void;
}

export function ProfileScreen({ targets, pantryStaples, onFeedback, onBack }: ProfileScreenProps) {
  const { user } = useAuth();
  const { openScreen } = useScreenStack();
  const { data: profile } = useProfileQuery();
  const saveDisplayName = useSaveDisplayName();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [canInstall, setCanInstall] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { data: aiUsage } = useAiUsageToday();
  const exportRecipes = useExportRecipes();
  const hasUnseenChanges = useHasUnseenChanges();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => setCanInstall(!isStandalone()), []);

  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);

  const displayName = profile?.displayName ?? null;

  const startEditing = () => {
    if (profile && !profile.sharingReady) {
      toast("Namen gibt es nach dem Datenbank-Update (Migration 011).");
      return;
    }
    setName(displayName ?? "");
    setEditingName(true);
  };

  const finishEditing = async () => {
    setEditingName(false);
    if (name.trim() === (displayName ?? "")) return;
    if (await saveDisplayName(name)) toast.success("Name gespeichert");
  };

  const install = async () => {
    if (await promptInstall()) return;
    toast(
      /iphone|ipad/i.test(navigator.userAgent)
        ? "In Safari: Teilen-Knopf → „Zum Home-Bildschirm“"
        : "Im Browser-Menü: „App installieren“ oder „Zum Startbildschirm hinzufügen“",
      { duration: 6000 },
    );
  };

  const rows = [
    {
      key: "targets",
      emoji: "🎯",
      tint: "bg-brand-accent-bg",
      title: "Tagesziele",
      subtitle: describeTargets(targets),
      onClick: () => openScreen({ kind: "nutrition-targets" }),
    },
    {
      key: "pantry",
      emoji: "🧂",
      tint: "bg-[#fff4e0]",
      title: "Grundzutaten",
      subtitle:
        pantryStaples.length > 0
          ? pantryStaples.slice(0, 3).map((staple) => staple.charAt(0).toUpperCase() + staple.slice(1)).join(", ") +
            (pantryStaples.length > 3 ? ` +${pantryStaples.length - 3}` : "")
          : "Was du immer zu Hause hast",
      onClick: () => openScreen({ kind: "pantry-staples" }),
    },
    {
      key: "export",
      emoji: "📦",
      tint: "bg-[#efe9fb]",
      title: exportRecipes.exporting ? "Wird exportiert …" : "Rezepte exportieren",
      subtitle: `${exportRecipes.count} ${exportRecipes.count === 1 ? "Rezept" : "Rezepte"} als Markdown (ZIP)`,
      onClick: () => {
        if (!exportRecipes.exporting) void exportRecipes.run();
      },
    },
    ...(canInstall
      ? [
          {
            key: "install",
            emoji: "📲",
            tint: "bg-[#e8f0fb]",
            title: "App installieren",
            subtitle: "Für Teilen aus Instagram & Co.",
            onClick: () => void install(),
          },
        ]
      : []),
  ];

  return (
    <SubPage title="Profil" tone="muted" onBack={onBack}>
      <section className="flex items-center gap-3.5 px-1 pb-2">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-accent-bg font-heading text-2xl font-extrabold text-brand-accent-dark">
          {profileInitial(displayName, user?.email)}
        </span>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => void finishEditing()}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") setEditingName(false);
              }}
              placeholder="Dein Name"
              aria-label="Name"
              enterKeyHint="done"
              className="h-9 w-full rounded-lg border-2 border-brand-accent bg-white px-2 text-[17px] font-bold text-brand-ink outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="flex max-w-full items-center gap-1.5 text-left text-[17px] font-bold text-brand-ink transition-opacity active:opacity-60"
            >
              <span className="truncate">{displayName || "Name für geteilte Rezepte"}</span>
              <Pencil className="size-3.5 shrink-0 text-brand-muted" />
            </button>
          )}
          <p className="truncate text-[13px] text-brand-secondary">{user?.email}</p>
        </div>
      </section>

      {aiUsage !== null && aiUsage !== undefined && <AiUsageCard used={aiUsage} />}

      <section className="overflow-hidden rounded-[18px] bg-white ring-1 ring-brand-card-border">
        {rows.map(({ key, ...row }) => (
          <ProfileRow key={key} {...row} />
        ))}
      </section>

      <section className="overflow-hidden rounded-[18px] bg-white ring-1 ring-brand-card-border">
        <ProfileRow
          emoji="🎉"
          tint="bg-brand-accent-bg"
          title="Was ist neu?"
          subtitle="Alle Änderungen an der App"
          badge={hasUnseenChanges ? "Neu" : undefined}
          onClick={() => openScreen({ kind: "whats-new" })}
        />
        <ProfileRow
          emoji="💬"
          tint="bg-brand-chip-neutral"
          title="Feedback senden"
          subtitle="Fehler oder Idee melden"
          onClick={onFeedback}
          feedbackTrigger
        />
        <form action="/api/auth/sign-out" method="post">
          <button
            type="submit"
            className="flex min-h-14 w-full items-center gap-3.5 px-3.5 text-left text-[15px] font-bold text-brand-red transition-colors active:bg-red-50"
          >
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-red-50">
              <LogOut className="size-[18px]" />
            </span>
            Abmelden
          </button>
        </form>
      </section>

      <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-[13px] text-brand-secondary">
        <Link href="/impressum" className="hover:text-brand-ink">
          Impressum
        </Link>
        <Link href="/datenschutz" className="hover:text-brand-ink">
          Datenschutz
        </Link>
        <button type="button" onClick={() => setConfirmingDelete(true)} className="hover:text-brand-red">
          Konto löschen
        </button>
      </footer>

      {confirmingDelete && (
        <DeleteAccountSheet
          onExport={() => void exportRecipes.run()}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </SubPage>
  );
}

function DeleteAccountSheet({ onExport, onClose }: { onExport: () => void; onClose: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      try {
        window.localStorage.removeItem(CACHE_STORAGE_KEY);
      } catch {
        // No on-device cache to clear.
      }
      window.location.assign("/");
    } catch (error) {
      console.error(error);
      toast.error("Konto konnte nicht gelöscht werden");
      setDeleting(false);
    }
  };

  return (
    <BottomSheet
      title="Konto löschen?"
      description="Alle Rezepte, Fotos, Wochenpläne und Einstellungen werden endgültig gelöscht. Geteilte Links funktionieren danach nicht mehr."
      onClose={onClose}
    >
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onExport}
          className="min-h-12 rounded-full bg-brand-accent-bg px-4 font-bold text-brand-accent-dark transition-transform active:scale-[0.98]"
        >
          Vorher Rezepte exportieren
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void deleteAccount()}
          className="min-h-12 rounded-full bg-brand-red px-4 font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {deleting ? "Wird gelöscht …" : "Endgültig löschen"}
        </button>
      </div>
    </BottomSheet>
  );
}

function AiUsageCard({ used }: { used: number }) {
  const shown = Math.min(used, DAILY_AI_LIMIT);
  const left = DAILY_AI_LIMIT - shown;

  return (
    <section
      aria-label="KI-Nutzung heute"
      className="space-y-2 rounded-[18px] bg-white px-3.5 py-3 ring-1 ring-brand-card-border"
    >
      <div className="flex items-center gap-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-accent-bg text-lg" aria-hidden="true">
          ✨
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-brand-ink">KI-Anfragen heute</span>
          <span className="block text-[13px] text-brand-secondary">
            {left > 0 ? `Noch ${left} frei · neue gibt es morgen` : "Für heute aufgebraucht · morgen geht es weiter"}
          </span>
        </span>
        <span className="shrink-0 text-[15px] font-bold tabular-nums text-brand-ink">
          {shown}/{DAILY_AI_LIMIT}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-brand-track">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            left > 0 ? "bg-brand-accent" : "bg-brand-warn",
          )}
          style={{ width: `${(shown / DAILY_AI_LIMIT) * 100}%` }}
        />
      </div>
    </section>
  );
}

function ProfileRow({
  emoji,
  tint,
  title,
  subtitle,
  onClick,
  badge,
  feedbackTrigger,
}: {
  emoji: string;
  tint: string;
  title: string;
  subtitle: string;
  onClick: () => void;
  // Small green "Neu" style marker after the title.
  badge?: string;
  // Opens the feedback card, which must not treat this tap as "outside".
  feedbackTrigger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-feedback-trigger={feedbackTrigger || undefined}
      className="flex min-h-16 w-full items-center gap-3.5 border-b border-brand-divider px-3.5 text-left transition-colors last:border-b-0 active:bg-brand-accent-bg-light"
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px] text-lg", tint)} aria-hidden="true">
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[15px] font-bold text-brand-ink">
          {title}
          {badge && (
            <span className="rounded-full bg-brand-accent px-1.5 py-px text-[11px] font-bold text-white">{badge}</span>
          )}
        </span>
        <span className="block truncate text-[13px] text-brand-secondary">{subtitle}</span>
      </span>
      <ChevronRight className="size-[18px] shrink-0 text-brand-muted" />
    </button>
  );
}
