import Link from "next/link";
import { cn } from "@/lib/utils";

export const LEGAL_LINKS = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
];

export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Rechtliches" className={cn("flex flex-wrap gap-x-4 gap-y-1", className)}>
      {LEGAL_LINKS.map(({ href, label }) => (
        <Link key={href} href={href} className="hover:text-brand-ink">
          {label}
        </Link>
      ))}
    </nav>
  );
}
