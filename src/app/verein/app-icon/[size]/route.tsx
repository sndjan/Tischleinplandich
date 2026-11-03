import { ImageResponse } from "next/og";

export const runtime = "edge";

const SIZES = [96, 180, 192, 512];

/**
 * Icon of the club app: a white hammer (Lucide "hammer") on the club blue. The glyph stays
 * inside the central 50% so the icon also works as a maskable icon. The 96px size is the
 * monochrome badge Android shows in the status bar.
 */
export function GET(_request: Request, { params }: { params: { size: string } }) {
  const size = Number(params.size);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  const badge = size === 96;
  const glyph = Math.round(size * (badge ? 0.8 : 0.5));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: badge ? "transparent" : "#2f5fd0",
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" />
          <path d="m18 15 4-4" />
          <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
        </svg>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
