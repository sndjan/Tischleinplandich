"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bug, Gift, Lightbulb, Loader2, MessageSquare, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import type { FeedbackCategory } from "@/types/database";
import { cn } from "@/lib/utils";

const MAX_MESSAGE_LENGTH = 2000;

const CATEGORIES: { value: FeedbackCategory; label: string; Icon: typeof Bug }[] = [
  { value: "bug", label: "Fehler", Icon: Bug },
  { value: "idea", label: "Idee", Icon: Lightbulb },
  { value: "other", label: "Sonstiges", Icon: MessageSquare },
];

/**
 * How far the on-screen keyboard covers the bottom of the page, so the card
 * can sit above it (iOS lays fixed elements out behind the keyboard).
 */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      setInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}

interface FeedbackPopoverProps {
  // Where the user was, e.g. "Mobil · plan"; stored to help reproduce bugs.
  context: string;
  onClose: () => void;
}

/**
 * A small card above the tab bar (below the header button on desktop) for a
 * quick note. It doesn't cover the page: the app stays usable while it's open,
 * and tapping elsewhere closes it as long as nothing has been typed.
 */
export function FeedbackPopover({ context, onClose }: FeedbackPopoverProps) {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const cardRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef(message);
  messageRef.current = message;
  const keyboardInset = useKeyboardInset();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // The feedback buttons toggle the card themselves, so they don't count as "outside".
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (cardRef.current?.contains(target) || target?.closest("[data-feedback-trigger]")) return;
      if (!messageRef.current.trim()) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const user = await getSessionUser();
      if (!user) throw new Error("Nicht angemeldet");

      // No .select(): users can write feedback but not read it back.
      const { error } = await createClient().from("feedback").insert({
        user_id: user.id,
        category,
        message: trimmed,
        context,
        user_agent: navigator.userAgent,
      });
      if (error) throw error;

      if (navigator.vibrate) navigator.vibrate(10);
      toast.success("Danke für dein Feedback!");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Senden fehlgeschlagen");
      setSending(false);
    }
  };

  return (
    <form
      ref={cardRef}
      onSubmit={send}
      aria-label="Feedback"
      data-overlay
      style={{ "--keyboard": `${keyboardInset}px` } as React.CSSProperties}
      className={cn(
        // Glides with the keyboard instead of jumping when it opens or closes.
        "fixed z-50 w-[min(22rem,calc(100vw-2rem))] animate-pop-up motion-safe:transition-[bottom] motion-safe:duration-300 motion-safe:ease-out space-y-2.5 rounded-[20px] bg-white p-3 shadow-[0_0_0_1px_rgba(28,43,34,0.06),0_12px_32px_rgba(28,43,34,0.18)]",
        // Above the tab bar's feedback button on mobile, under the header button on desktop.
        "bottom-[calc(5.5rem+env(safe-area-inset-bottom)+var(--keyboard))] right-4 origin-bottom-right",
        "lg:bottom-auto lg:top-[68px] lg:origin-top-right",
      )}
    >
      <div className="flex items-center gap-1.5">
        <div role="radiogroup" aria-label="Art des Feedbacks" className="flex flex-1 gap-1">
          {CATEGORIES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={category === value}
              // Keeps the focus in the text field, so the keyboard stays open.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setCategory(value)}
              className={cn(
                "flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-bold transition-all active:scale-95",
                category === value ? "bg-brand-accent-bg text-brand-accent-dark" : "text-brand-secondary",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-brand-muted transition-transform active:scale-90 active:bg-black/5"
        >
          <X className="size-4" />
        </button>
      </div>

      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit();
        }}
        maxLength={MAX_MESSAGE_LENGTH}
        rows={3}
        autoFocus
        disabled={sending}
        aria-label="Nachricht"
        placeholder={
          category === "bug"
            ? "Was hat nicht geklappt?"
            : category === "idea"
              ? "Was wäre praktisch?"
              : "Was möchtest du sagen?"
        }
        className="block w-full resize-none rounded-xl bg-brand-chip-neutral px-3 py-2.5 text-[15px] text-brand-ink outline-none placeholder:text-brand-muted focus:ring-2 focus:ring-brand-accent-bg"
      />

      <p className="flex items-start gap-1.5 text-xs leading-snug text-brand-secondary">
        <Gift className="mt-px size-3.5 shrink-0 text-brand-accent-dark" aria-hidden="true" />
        <span>
          Bauen wir es ein, schenken wir dir bis zu 1 Monat Premium.{" "}
          {/* New tab, so a half-written message stays where it is. */}
          <Link href="/feedback-belohnung" target="_blank" className="font-semibold text-brand-accent-dark underline">
            Bedingungen
          </Link>
        </span>
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-brand-muted">Ein kurzer Satz reicht.</span>
        <button
          type="submit"
          disabled={!message.trim() || sending}
          className="flex h-9 items-center gap-1.5 rounded-full bg-brand-accent-dark px-4 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-40"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Senden
        </button>
      </div>
    </form>
  );
}
