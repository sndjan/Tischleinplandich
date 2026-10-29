import { NextResponse } from "next/server";

// Evaluated per request, but the value is fixed at build time: it names this deploy.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
