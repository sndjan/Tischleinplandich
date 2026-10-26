"use client";

import { useState } from "react";
import { Bug, Lightbulb, MessageSquare, Send } from "lucide-react";
import toast from "react-hot-toast";
import { createClient, getSessionUser } from "@/lib/supabase/client";
import type { FeedbackCategory } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SubPage } from "./sub-page";

const FORM_ID = "feedback-form";
const MAX_MESSAGE_LENGTH = 2000;

const CATEGORIES: {
  value: FeedbackCategory;
  label: string;
  Icon: typeof Bug;
}[] = [
  { value: "bug", label: "Fehler", Icon: Bug },
  { value: "idea", label: "Idee", Icon: Lightbulb },
  { value: "other", label: "Sonstiges", Icon: MessageSquare },
];

interface FeedbackScreenProps {
  // Where the user was when opening feedback, e.g. "Planer · Woche".
  context?: string;
  onBack: () => void;
  onSent: () => void;
}

export function FeedbackScreen({ context, onBack, onSent }: FeedbackScreenProps) {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const supabase = createClient();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      toast.error("Nachricht fehlt");
      return;
    }

    setIsSending(true);

    try {
      const user = await getSessionUser();

      if (!user) {
        toast.error("Nicht angemeldet");
        return;
      }

      // No .select(): users can write feedback but not read it back.
      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        category,
        message: trimmedMessage,
        context: context ?? null,
        user_agent: navigator.userAgent,
      });

      if (error) throw error;

      toast.success("Danke für dein Feedback!");
      setMessage("");
      onSent();
    } catch (err) {
      console.error(err);
      toast.error("Senden fehlgeschlagen");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SubPage
      title="Feedback"
      description="Fehler gefunden oder eine Idee? Ein kurzer Satz reicht."
      onBack={onBack}
      backDisabled={isSending}
      footer={
        <Button
          type="submit"
          form={FORM_ID}
          className="w-full"
          disabled={isSending || !message.trim()}
        >
          <Send className="h-4 w-4" />
          {isSending ? "Sendet…" : "Senden"}
        </Button>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <div
          role="radiogroup"
          aria-label="Art des Feedbacks"
          className="flex gap-1 rounded-xl bg-brand-chip-neutral p-1"
        >
          {CATEGORIES.map(({ value, label, Icon }) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="sm"
              role="radio"
              aria-checked={category === value}
              onClick={() => setCategory(value)}
              className={cn(
                "flex-1 rounded-full",
                category === value && "bg-white text-brand-accent-dark shadow-sm",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="feedback-message">Nachricht</Label>
          <Textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={
              category === "bug"
                ? "z. B. Beim Speichern eines Rezepts passiert nichts"
                : category === "idea"
                  ? "z. B. Ich hätte gern eine Wochenübersicht"
                  : "Was möchtest du uns sagen?"
            }
            className="h-32"
            disabled={isSending}
            autoFocus
          />
        </div>
      </form>
    </SubPage>
  );
}
