import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Activity, Check, Clock, Download, Plus, Share2, ShoppingCart, Sparkles, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { FAQ, LIFETIME_PRICE, MONTHLY_PRICE } from "./content";
import { LazyLandingDemo } from "./landing-demo-lazy";
import { RotatingHeadline } from "./rotating-headline";
import { WaitlistForm } from "./waitlist-form";
import { LegalLinks } from "@/components/legal/legal-links";

const SIGN_IN = "/auth/signin";

const HIGHLIGHTS = ["KI-Rezeptimport", "Kalorien & Protein", "Automatische Einkaufsliste", "Deine Daten, dein Export"];

const STEPS = [
  {
    title: "Rezepte sammeln",
    text: "Link, Foto oder PDF einfügen – die KI übernimmt Zutaten, Schritte und Nährwerte. Oder selbst eintippen.",
  },
  {
    title: "Woche planen",
    text: "Frühstück, Mittag- und Abendessen auf die Tage legen. Kalorien und Protein siehst du sofort pro Tag.",
  },
  {
    title: "Einkaufen & kochen",
    text: "Die Einkaufsliste fasst alle Zutaten der Woche zusammen. Am Herd führt dich der Kochmodus Schritt für Schritt.",
  },
];

const FEATURES: { Icon: LucideIcon; title: string; text: string; highlight?: boolean }[] = [
  {
    Icon: Sparkles,
    title: "Rezepte per KI importieren",
    text: "Vom Foodblog, aus Instagram oder vom Kochbuch-Foto direkt in deine Sammlung – sauber formatiert.",
  },
  {
    Icon: Activity,
    title: "Kalorien & Protein",
    text: "Eigene Ziele festlegen und Tag für Tag sehen, wie nah du dran bist – ohne jede Mahlzeit einzeln zu tracken.",
  },
  {
    Icon: ShoppingCart,
    title: "Automatische Einkaufsliste",
    text: "Gleiche Zutaten werden addiert, Vorräte wie Salz und Öl bleiben weg. Abhaken im Laden.",
  },
  {
    Icon: Download,
    title: "Deine Daten gehören dir",
    text: "Alle Rezepte jederzeit als Markdown exportieren – lesbar in jedem Editor, ohne Lock-in.",
    highlight: true,
  },
  {
    Icon: Clock,
    title: "Kochmodus",
    text: "Große Schrift, ein Schritt nach dem anderen, Bildschirm bleibt an. Gemacht für Hände voller Mehl.",
  },
  {
    Icon: Share2,
    title: "Teilen & überall dabei",
    text: "Rezepte per Link teilen. Läuft im Browser auf Handy, Tablet und Computer – Anmeldung ohne Passwort.",
  },
];

const PLANS = [
  {
    name: "Monatlich",
    price: MONTHLY_PRICE.label,
    period: "/ Monat",
    note: "geplant · inkl. MwSt. · monatlich kündbar",
    perks: ["Unbegrenzt Rezepte & Wochenpläne", "KI-Import per Link, Foto & PDF", "Einkaufsliste, Nährwerte, Export"],
    featured: false,
  },
  {
    name: "Lifetime",
    price: LIFETIME_PRICE.label,
    period: "einmalig",
    note: "geplant · inkl. MwSt. · kein Abo",
    perks: ["Alles aus Monatlich", "Alle künftigen Funktionen inklusive", "Nie wieder an Kündigung denken"],
    featured: true,
  },
];

const NAV_LINKS = [
  { href: "#demo", label: "Demo" },
  { href: "#funktionen", label: "Funktionen" },
  { href: "#preise", label: "Preise" },
  { href: "#warteliste", label: "Warteliste" },
  { href: "#faq", label: "FAQ" },
];

const sectionHeading = "font-heading text-[clamp(30px,3.6vw,44px)] font-black tracking-[-0.01em]";
const primaryButton =
  "inline-flex items-center justify-center rounded-full bg-brand-accent-dark px-7 py-4 text-[17px] font-bold text-white transition-colors hover:bg-brand-ink";

// Product, prices and FAQ for search engines; built from the same content as the page.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web, iOS, Android",
      inLanguage: "de",
      description:
        "Wochenplaner für Essen: Rezepte per KI importieren, Mahlzeiten planen, Kalorien und Protein im Blick behalten und die Einkaufsliste automatisch erstellen.",
      // Free during the beta; add the paid plans here once they can be bought.
      offers: [{ "@type": "Offer", name: "Beta", price: "0", priceCurrency: "EUR" }],
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-brand-app-bg text-brand-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-accent">
            <UtensilsCrossed className="size-5 text-white" aria-hidden="true" />
          </span>
          <span className="font-heading text-xl font-black">{SITE_NAME}</span>
        </Link>
        <nav aria-label="Hauptnavigation" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] font-medium">
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className="hidden text-[#3c4a42] hover:text-brand-ink md:inline">
              {label}
            </a>
          ))}
          <Link href={SIGN_IN} className="font-bold hover:text-brand-accent-dark">
            Anmelden
          </Link>
          <Link
            href={SIGN_IN}
            className="hidden rounded-full bg-brand-accent-dark px-[18px] py-3 font-bold text-white transition-colors hover:bg-brand-ink sm:inline-block"
          >
            Kostenlos testen
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-[1040px] px-6 pb-10 pt-12 text-center sm:pt-[72px]">
          <RotatingHeadline />
          <p className="mx-auto mt-6 max-w-[560px] text-xl leading-[1.55] text-[#4a5750]">
            Rezepte rein, Woche planen, Einkaufsliste mitnehmen. Und alles jederzeit exportieren.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={SIGN_IN} className={primaryButton}>
              Beta kostenlos testen
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center justify-center rounded-full border border-brand-input-border bg-white px-7 py-4 text-[17px] font-bold transition-colors hover:border-brand-ink"
            >
              Demo ausprobieren
            </a>
          </div>
          <ul aria-label="Highlights" className="mt-7 flex flex-wrap justify-center gap-2">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="rounded-full border border-brand-card-border bg-white px-3.5 py-2 text-sm font-medium text-[#3c4a42]">
                {highlight}
              </li>
            ))}
          </ul>
        </section>

        <section id="demo" aria-labelledby="demo-heading" className="mx-auto max-w-[1320px] scroll-mt-6 px-4 pb-[104px] pt-8 sm:px-6">
          <div className="mx-auto mb-6 flex max-w-[620px] flex-col items-center gap-3 text-center">
            <span className="rounded-full bg-brand-highlight px-3 py-1.5 text-[13px] font-bold text-brand-ink">Interaktive Demo</span>
            <h2 id="demo-heading" className="font-heading text-[clamp(26px,3vw,34px)] font-black leading-tight">
              Probier den Essensplaner aus
            </h2>
            <p className="text-[15px] leading-relaxed text-brand-secondary">
              Plane ein Gericht, öffne ein Rezept oder importiere eins per KI – die Einkaufsliste rechnet mit.
              <span className="hidden xl:inline"> Computer und Handy teilen sich dieselben Daten.</span> Beispieldaten,
              nichts wird gespeichert.
            </p>
          </div>
          <LazyLandingDemo />
        </section>

        <section aria-labelledby="steps-heading" className="bg-white px-6 py-24">
          <div className="mx-auto max-w-[1200px]">
            <h2 id="steps-heading" className={cn(sectionHeading, "text-center")}>
              So einfach geht der Wochenplan
            </h2>
            <ol className="mt-14 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
              {STEPS.map(({ title, text }, index) => (
                <li key={title} className="rounded-3xl bg-brand-app-bg p-8">
                  <span className="flex size-11 items-center justify-center rounded-full bg-brand-accent font-heading text-xl font-black text-white">
                    {index + 1}
                  </span>
                  <h3 className="mb-2 mt-5 font-heading text-[22px] font-extrabold">{title}</h3>
                  <p className="leading-relaxed text-[#4a5750]">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="funktionen" aria-labelledby="features-heading" className="px-6 py-24">
          <div className="mx-auto max-w-[1200px]">
            <h2 id="features-heading" className={cn(sectionHeading, "max-w-[640px]")}>
              Alles, was du für die Essensplanung brauchst
            </h2>
            <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-4">
              {FEATURES.map(({ Icon, title, text, highlight }) => (
                <article key={title} className="rounded-3xl border border-brand-card-border bg-white p-7">
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-[14px]",
                      highlight ? "bg-brand-highlight text-brand-ink" : "bg-brand-accent-bg text-brand-accent-dark",
                    )}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <h3 className="mb-2 mt-[18px] font-heading text-xl font-extrabold">{title}</h3>
                  <p className="leading-relaxed text-[#4a5750]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="preise" aria-labelledby="pricing-heading" className="bg-brand-ink px-6 py-24 text-white">
          <div className="mx-auto max-w-[920px]">
            <h2 id="pricing-heading" className={cn(sectionHeading, "text-center")}>
              Einfache Preise
            </h2>
            <p className="mx-auto mt-3.5 max-w-[520px] text-center text-lg text-[#c9d6cd]">
              Während der Beta ist alles kostenlos. Danach gibt es einen Plan mit allen Funktionen – monatlich oder
              einmal für immer.
            </p>
            <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
              {PLANS.map((plan) => (
                <article
                  key={plan.name}
                  className={cn(
                    "relative flex flex-col rounded-[28px] p-9",
                    plan.featured ? "bg-brand-accent-dark text-white" : "bg-white text-brand-ink",
                  )}
                >
                  {plan.featured && (
                    <p className="absolute right-5 top-5 rounded-full bg-brand-highlight px-3 py-1.5 text-[13px] font-bold text-brand-ink">
                      Einmal zahlen
                    </p>
                  )}
                  <h3 className="font-heading text-[22px] font-extrabold">{plan.name}</h3>
                  <p className="mt-[18px] flex items-baseline gap-1.5">
                    <span className="font-heading text-[52px] font-black">{plan.price}</span>
                    <span className={plan.featured ? "text-brand-accent-bg" : "text-brand-secondary"}>{plan.period}</span>
                  </p>
                  <p className={cn("mt-1.5 text-sm", plan.featured ? "text-brand-accent-bg" : "text-brand-secondary")}>{plan.note}</p>
                  <ul className="mb-8 mt-7 flex flex-1 flex-col gap-3">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex gap-2.5">
                        <Check
                          className={cn("size-5 flex-none", plan.featured ? "text-white" : "text-brand-accent")}
                          strokeWidth={2.6}
                          aria-hidden="true"
                        />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#warteliste"
                    className={cn(
                      "rounded-full p-4 text-center text-[17px] font-bold transition-colors",
                      plan.featured
                        ? "bg-brand-ink text-white hover:bg-black"
                        : "bg-brand-accent-bg text-brand-accent-dark hover:bg-brand-track",
                    )}
                  >
                    Zum Start benachrichtigen
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="warteliste" aria-labelledby="waitlist-heading" className="scroll-mt-6 px-6 pt-24">
          <div className="mx-auto max-w-[760px] text-center">
            <span className="rounded-full bg-brand-highlight px-3 py-1.5 text-[13px] font-bold text-brand-ink">Warteliste</span>
            <h2 id="waitlist-heading" className={cn(sectionHeading, "mt-4")}>
              Als Erstes vom Start erfahren
            </h2>
            <p className="mx-auto mb-8 mt-3.5 max-w-[520px] text-lg text-[#4a5750]">
              Trag dich ein und wir sagen dir Bescheid, sobald die Bezahlpläne starten.
            </p>
            <WaitlistForm />
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-heading" className="px-6 py-24">
          <div className="mx-auto max-w-[760px]">
            <h2 id="faq-heading" className={cn(sectionHeading, "mb-8 text-center")}>
              Häufige Fragen
            </h2>
            <div className="flex flex-col gap-2.5">
              {FAQ.map(({ question, answer }) => (
                <details key={question} className="group rounded-[18px] border border-brand-card-border bg-white px-[22px]">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold [&::-webkit-details-marker]:hidden">
                    {question}
                    <Plus
                      className="size-6 flex-none text-brand-accent transition-transform group-open:rotate-45"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="pb-5 leading-relaxed text-[#4a5750]">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="cta-heading" className="px-6 pb-24">
          <div className="mx-auto max-w-[1200px] rounded-[32px] bg-brand-accent-bg px-8 py-16 text-center">
            <h2 id="cta-heading" className="font-heading text-[clamp(28px,3.4vw,42px)] font-black">
              Nächste Woche ist schon geplant.
            </h2>
            <p className="mb-7 mt-3.5 text-lg text-[#4a5750]">
              In fünf Minuten steht dein erster Wochenplan. Während der Beta kostenlos.
            </p>
            <Link href={SIGN_IN} className={primaryButton}>
              Beta kostenlos testen
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-card-border px-6 py-8">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-4 text-sm text-brand-secondary">
          <p>© {new Date().getFullYear()} {SITE_NAME}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <LegalLinks />
            <Link href={SIGN_IN} className="hover:text-brand-ink">
              Anmelden
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
