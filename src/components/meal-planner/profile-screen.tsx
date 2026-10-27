"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, LogOut, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/context";
import { isStandalone, promptInstall } from "@/lib/install-prompt";
import { queryKeys, useProfileQuery, useUserId } from "@/hooks/use-planner-data";
import { cn } from "@/lib/utils";
import type { NutritionTargetSettings } from "./nutrition-target-settings";
import { SubPage } from "./sub-page";
import { useScreenStack } from "./screen-stack";

const formatNumber = (value: number) => value.toLocaleString("de-DE", { maximumFractionDigits: 0 });

export function describeTargets(targets: NutritionTargetSettings) {
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

interface ProfileScreenProps {
  targets: NutritionTargetSettings;
  pantryStaples: string[];
  feedbackContext: string;
  onBack: () => void;
}

export function ProfileScreen({ targets, pantryStaples, feedbackContext, onBack }: ProfileScreenProps) {
  const { user } = useAuth();
  const { openScreen } = useScreenStack();
  const { data: profile } = useProfileQuery();
  const saveDisplayName = useSaveDisplayName();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [canInstall, setCanInstall] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

      <section className="overflow-hidden rounded-[18px] bg-white ring-1 ring-brand-card-border">
        {rows.map(({ key, ...row }) => (
          <ProfileRow key={key} {...row} />
        ))}
      </section>

      <section className="overflow-hidden rounded-[18px] bg-white ring-1 ring-brand-card-border">
        <ProfileRow
          emoji="💬"
          tint="bg-brand-chip-neutral"
          title="Feedback senden"
          subtitle="Fehler oder Idee melden"
          onClick={() => openScreen({ kind: "feedback", context: feedbackContext })}
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
    </SubPage>
  );
}

function ProfileRow({
  emoji,
  tint,
  title,
  subtitle,
  onClick,
}: {
  emoji: string;
  tint: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center gap-3.5 border-b border-brand-divider px-3.5 text-left transition-colors last:border-b-0 active:bg-brand-accent-bg-light"
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px] text-lg", tint)} aria-hidden="true">
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-brand-ink">{title}</span>
        <span className="block truncate text-[13px] text-brand-secondary">{subtitle}</span>
      </span>
      <ChevronRight className="size-[18px] shrink-0 text-brand-muted" />
    </button>
  );
}
