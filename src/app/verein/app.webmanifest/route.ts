import { NextResponse } from "next/server";
import { CLUB_NAME } from "@/lib/club/events";

/**
 * Manifest of the club app. Its own id and scope make /verein installable as a separate app
 * next to Tischleinplandich, opening straight into the list of work assignments.
 */
export function GET() {
  return NextResponse.json(
    {
      id: "/verein",
      name: `${CLUB_NAME} – Arbeitseinsätze`,
      short_name: CLUB_NAME,
      description: "Arbeitseinsätze im Verein: ansehen, eintragen und benachrichtigt werden.",
      lang: "de",
      start_url: "/verein",
      scope: "/verein",
      display: "standalone",
      background_color: "#f5f7fb",
      theme_color: "#f5f7fb",
      icons: [
        { src: "/verein/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/verein/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/verein/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
