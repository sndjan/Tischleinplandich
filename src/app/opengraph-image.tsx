import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Essensplaner – Essensplanung, die Kalorien mitzählt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "Essensplaner";
const HEADLINE = ["Essensplanung, die", "Kalorien mitzählt."];
const TAGLINE = "Wochenplan · KI-Rezeptimport · Einkaufsliste automatisch";

type Font = { name: string; data: ArrayBuffer; weight: 500 | 800 | 900; style: "normal" };

// The page's fonts, trimmed by Google Fonts to the characters actually drawn.
// Without a user agent Google serves TrueType, which the image renderer needs.
async function loadGoogleFont(family: string, weight: Font["weight"], text: string): Promise<Font> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(cssUrl)).text();
  const fontUrl = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!fontUrl) throw new Error(`No TrueType source for ${family} ${weight}`);
  return { name: family, data: await (await fetch(fontUrl)).arrayBuffer(), weight, style: "normal" };
}

async function loadFonts(): Promise<Font[]> {
  try {
    return await Promise.all([
      loadGoogleFont("Nunito", 900, HEADLINE.join("") + BRAND),
      loadGoogleFont("DM Sans", 500, TAGLINE),
    ]);
  } catch (error) {
    // Still return an image, in the default font, if Google Fonts can't be reached.
    console.error("Open Graph fonts failed to load", error);
    return [];
  }
}

// Preview image for links to the landing page in chats and social media.
export default async function OpenGraphImage() {
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#f7f6f3",
          color: "#1c2b22",
          fontFamily: "Nunito",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 900 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#4f9c6e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
              <path d="M7 2v20" />
              <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
            </svg>
          </div>
          {BRAND}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 56,
            fontSize: 84,
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
          }}
        >
          <span>{HEADLINE[0]}</span>
          <span style={{ display: "flex" }}>
            <span style={{ background: "#ffe58a", borderRadius: 18, padding: "0 18px" }}>{HEADLINE[1]}</span>
          </span>
        </div>
        <div style={{ marginTop: 40, fontSize: 32, fontWeight: 500, color: "#4a5750", fontFamily: "DM Sans" }}>{TAGLINE}</div>
      </div>
    ),
    { ...size, fonts },
  );
}
