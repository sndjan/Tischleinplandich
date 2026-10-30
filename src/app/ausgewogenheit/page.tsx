import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { RECIPE_RULES, WEEK_RULES } from "@/lib/balance";

export const metadata: Metadata = {
  title: "So berechnen wir die Ausgewogenheit",
  description: "Die Regeln hinter dem Ausgewogenheits-Wert für Rezepte und Wochen, mit Quellen.",
  alternates: { canonical: "/ausgewogenheit" },
};

// The numbers come from src/lib/balance.ts, so this page always matches the score.
const r = RECIPE_RULES;
const w = WEEK_RULES;
const pct = (value: number) => `${Math.round(value * 100)} %`;

export default function AusgewogenheitPage() {
  return (
    <LegalPage title="So berechnen wir die Ausgewogenheit">
      <p>
        Jedes Rezept und jede geplante Woche bekommt einen Wert von 0 bis 100. Er zeigt, wie gut das Essen zu
        den Empfehlungen für eine ausgewogene Ernährung passt. Er ist eine Orientierung, kein Urteil über
        einzelne Gerichte und keine medizinische oder Ernährungsberatung.
      </p>

      <h2>Wie der Wert entsteht</h2>
      <p>
        Beim Import eines Rezepts (oder auf Knopfdruck) schätzt eine KI nur Fakten: welche Zutaten in einer
        Portion stecken und wie viel davon, wie stark sie verarbeitet sind, und wie viel Ballaststoffe,
        zugesetzter Zucker, gesättigte Fette und Salz eine Portion hat. Die Punkte vergibt die KI nicht. Sie
        entstehen aus den festen Regeln unten, damit dasselbe Rezept immer denselben Wert bekommt und jeder
        Punkt nachvollziehbar ist.
      </p>
      <p>
        Die Fakten sind Schätzungen. Sie können danebenliegen, besonders bei ungenauen Mengenangaben. Ändert
        sich ein Rezept, wird der Wert als veraltet markiert und kann neu berechnet werden.
      </p>
      <p>
        Mengen vergleichen wir pro 1.000 kcal statt pro Portion. So werden ein kleiner Salat und ein großer
        Auflauf mit demselben Maßstab gemessen. Gerichte unter 200 kcal rechnen wir dabei wie 200 kcal, damit
        kleine Mengen nicht übertrieben ins Gewicht fallen.
      </p>

      <h2>Rezept: 8 Bereiche, zusammen 100 Punkte</h2>
      <ul>
        <li>
          <strong>Gemüse &amp; Obst (25 Punkte):</strong> volle Punktzahl ab {r.vegFruitFullPer1000} g pro
          1.000 kcal. Kartoffeln zählen nicht dazu. Grundlage: mindestens 5 Portionen (etwa 550 g) Gemüse und
          Obst am Tag (DGE).
        </li>
        <li>
          <strong>Ballaststoffe (15 Punkte):</strong> volle Punktzahl ab {r.fiberFullPer1000} g pro 1.000
          kcal, entsprechend mindestens 30 g am Tag (DGE).
        </li>
        <li>
          <strong>Verarbeitung (15 Punkte):</strong> nach der NOVA-Einteilung. Unverarbeitete Zutaten zählen
          voll, verarbeitete (z. B. Käse, Brot) halb, hochverarbeitete (z. B. Fertigsoßen) gar nicht.
          Küchenzutaten wie Öl, Salz und Zucker zählen hier nicht mit, sie stecken in Fett, Zucker und Salz.
          Volle Punktzahl ab {pct(r.processingFull)} unverarbeitet (nach Gewicht), keine Punkte unter{" "}
          {pct(r.processingZero)}.
        </li>
        <li>
          <strong>Eiweißquellen (10 Punkte):</strong> 10 Punkte mit mindestens {r.goodProteinMinGrams} g
          Hülsenfrüchten, Fisch oder Nüssen pro Portion, sonst 6. Rotes Fleisch zieht 4 Punkte ab, Wurst,
          Schinken oder Speck 6 (je ab {r.meatMinGrams} g). Grundlage: DGE und die Einstufung von
          verarbeitetem Fleisch durch die WHO (IARC).
        </li>
        <li>
          <strong>Vollkorn (10 Punkte):</strong> Anteil des Getreides, der Vollkorn ist. Gerichte ohne
          Getreide bekommen die volle Punktzahl.
        </li>
        <li>
          <strong>Fettqualität (10 Punkte):</strong> gesättigte Fette bis {r.satFatFullPct} % der Energie
          geben volle Punkte, ab {r.satFatZeroPct} % keine (DGE, WHO).
        </li>
        <li>
          <strong>Zugesetzter Zucker (10 Punkte):</strong> bis {r.sugarFullPct} % der Energie volle Punkte,
          ab {r.sugarZeroPct} % keine. Natürlicher Zucker in Obst und Milch zählt nicht (WHO).
        </li>
        <li>
          <strong>Salz (5 Punkte):</strong> bis {r.saltFullPer1000.toLocaleString("de-DE")} g pro 1.000
          kcal volle Punkte, ab {r.saltZeroPer1000} g keine, entsprechend höchstens 5 g Salz am Tag (WHO).
        </li>
      </ul>
      <p>Zwischen den Grenzen steigen die Punkte gleichmäßig an.</p>

      <h2>Woche: Rezepte plus Abwechslung</h2>
      <p>
        Einzelne Gerichte sagen wenig über die Ernährung aus; wichtig ist, wie die Woche zusammenpasst. Der
        Wochenwert setzt sich so zusammen:
      </p>
      <ul>
        <li>
          <strong>Ø Rezepte (50 Punkte):</strong> der Durchschnitt der Rezeptwerte aller bewerteten
          Mahlzeiten der Woche.
        </li>
        <li>
          <strong>Hülsenfrüchte (15 Punkte):</strong> volle Punktzahl ab {w.legumesFullGrams} g pro Person
          und Woche. Die DGE empfiehlt mindestens 125 g; mehr ist ausdrücklich erwünscht.
        </li>
        <li>
          <strong>Fisch (10 Punkte):</strong> volle Punktzahl ab {w.fishFullGrams} g pro Person und Woche,
          entsprechend 1 bis 2 Portionen (DGE).
        </li>
        <li>
          <strong>Fleisch &amp; Wurst (15 Punkte):</strong> volle Punktzahl bis {w.meatFullGrams} g pro
          Person und Woche (DGE), keine ab {w.meatZeroGrams} g. Geflügel zählt mit.
        </li>
        <li>
          <strong>Pflanzenvielfalt (10 Punkte):</strong> volle Punktzahl ab {w.plantsFull} verschiedenen
          Pflanzen (Gemüse, Obst, Getreide, Hülsenfrüchte, Nüsse, Kräuter). Mehr Vielfalt hängt in Studien
          mit einer vielfältigeren Darmflora zusammen.
        </li>
      </ul>
      <p>
        Jede geplante Mahlzeit zählt als eine Portion für eine Person. Die Ziele gelten für eine volle Woche
        mit {w.fullWeekMeals} Mahlzeiten (Mittag- und Abendessen); sind weniger geplant, werden sie
        anteilig kleiner. Einen Wochenwert gibt es ab {w.minScoredMeals} bewerteten Rezepten. Auswärts
        essen und Rezepte ohne aktuellen Wert werden nicht mitgerechnet.
      </p>
      <p>
        Die Ziele sind noch nicht an Ernährungsformen angepasst: Wer vegetarisch isst, bekommt zum Beispiel
        keine Fischpunkte.
      </p>

      <h2>Bewertungsstufen</h2>
      <ul>
        <li>80–100: sehr ausgewogen</li>
        <li>60–79: ausgewogen</li>
        <li>40–59: teils ausgewogen</li>
        <li>0–39: eher selten</li>
      </ul>

      <h2>Quellen</h2>
      <ul>
        <li>Deutsche Gesellschaft für Ernährung (DGE): Gut essen und trinken – lebensmittelbezogene Ernährungsempfehlungen, 2024</li>
        <li>WHO: Guideline – Sugars intake for adults and children, 2015</li>
        <li>WHO: Guideline – Sodium intake for adults and children, 2012</li>
        <li>WHO: Saturated fatty acid and trans-fatty acid intake for adults and children, 2023</li>
        <li>IARC Monographs Vol. 114: Red meat and processed meat, 2018</li>
        <li>Monteiro et al.: Ultra-processed foods – what they are and how to identify them (NOVA), Public Health Nutrition, 2019</li>
        <li>McDonald et al.: American Gut – an open platform for citizen science microbiome research, mSystems, 2018</li>
        <li>Die Bewertung pro 1.000 kcal folgt dem Healthy Eating Index (USDA)</li>
      </ul>
      <p>Stand: Version 1, Oktober 2026.</p>
    </LegalPage>
  );
}
