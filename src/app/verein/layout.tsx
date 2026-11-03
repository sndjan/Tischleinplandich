import type { Metadata, Viewport } from "next";
import { CLUB_NAME } from "@/lib/club/events";

export const metadata: Metadata = {
  title: `Arbeitseinsätze · ${CLUB_NAME}`,
  description: "Arbeitseinsätze im Verein: ansehen, eintragen und benachrichtigt werden.",
  applicationName: CLUB_NAME,
  // Replaces the planner's manifest, so installing from here adds the club app.
  manifest: "/verein/app.webmanifest",
  appleWebApp: { capable: true, title: CLUB_NAME, statusBarStyle: "default" },
  icons: { apple: "/verein/app-icon/180" },
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: "#f5f7fb",
};

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return children;
}
