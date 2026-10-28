// Copy shared by the landing page and its structured data (JSON-LD), so the
// prices and FAQ that search engines read always match what visitors see.

export const MONTHLY_PRICE = { label: "4,90 €", value: "4.90" };
// Placeholder until the lifetime price is decided.
export const LIFETIME_PRICE = { label: "59 €", value: "59.00" };

export const ROTATING_WORDS = [
  "Kalorien mitzählt.",
  "Rezepte per KI liest.",
  "den Einkauf schreibt.",
  "dir gehört.",
];

export const FAQ: { question: string; answer: string }[] = [
  {
    question: "Funktioniert der Essensplaner auf dem Handy?",
    answer:
      "Ja. Er läuft in jedem Browser und lässt sich auf iPhone und Android auf den Startbildschirm legen. Deine Pläne sind auf allen Geräten gleich.",
  },
  {
    question: "Wie kommen meine Rezepte hinein?",
    answer:
      "Füge einen Link, ein Foto oder ein PDF ein – die KI liest Zutaten, Mengen und Schritte aus. Du kannst Rezepte natürlich auch selbst anlegen.",
  },
  {
    question: "Kann ich meine Daten mitnehmen?",
    answer:
      "Ja. Im Profil exportierst du alle Rezepte als Markdown-Dateien in einem ZIP – lesbar in jedem Texteditor und in Apps wie Obsidian.",
  },
  {
    question: "Wie entsteht die Einkaufsliste?",
    answer:
      "Aus allen Mahlzeiten deiner Woche. Gleiche Zutaten werden zusammengerechnet, und Vorräte, die du immer daheim hast, kannst du ausblenden.",
  },
  {
    question: "Was kostet der Essensplaner?",
    answer: `Während der Beta nichts. Danach sind zwei Pläne mit allen Funktionen geplant: Monatlich für ${MONTHLY_PRICE.label}, jederzeit kündbar, oder Lifetime als Einmalzahlung. Wer auf der Warteliste steht, erfährt als Erstes vom Start.`,
  },
  {
    question: "Brauche ich ein Passwort?",
    answer: "Nein. Du meldest dich mit einem Link oder einem 6-stelligen Code per E-Mail an.",
  },
];
