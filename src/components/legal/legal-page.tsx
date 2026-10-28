import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { SITE_NAME } from "@/lib/site";
import { LegalLinks } from "./legal-links";

/**
 * Plain reading layout for Impressum, Datenschutz and similar pages.
 */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-brand-app-bg text-brand-ink">
      <header className="mx-auto flex max-w-[760px] items-center px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-accent">
            <UtensilsCrossed className="size-5 text-white" aria-hidden="true" />
          </span>
          <span className="font-heading text-xl font-black">{SITE_NAME}</span>
        </Link>
      </header>
      <main className="mx-auto max-w-[760px] px-6 pb-16 pt-6">
        <h1 className="font-heading text-[clamp(30px,4vw,40px)] font-black">{title}</h1>
        <div className="mt-8 space-y-4 leading-relaxed text-[#3c4a42] [&_a]:text-brand-accent-dark [&_a]:underline [&_h2]:mt-10 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-brand-ink [&_h3]:mt-6 [&_h3]:font-bold [&_h3]:text-brand-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </div>
      </main>
      <footer className="border-t border-brand-card-border px-6 py-8">
        <div className="mx-auto max-w-[760px] text-sm text-brand-secondary">
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
