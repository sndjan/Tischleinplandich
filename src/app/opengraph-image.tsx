import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Essensplaner – Essensplanung, die Kalorien mitzählt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Preview image for links to the landing page in chats and social media.
export default function OpenGraphImage() {
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
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 800 }}>
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
          Essensplaner
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 56, fontSize: 84, fontWeight: 800, lineHeight: 1.08 }}>
          <span>Essensplanung, die</span>
          <span style={{ display: "flex" }}>
            <span style={{ background: "#ffe58a", borderRadius: 18, padding: "0 18px" }}>Kalorien mitzählt.</span>
          </span>
        </div>
        <div style={{ marginTop: 40, fontSize: 32, color: "#4a5750" }}>
          Wochenplan · KI-Rezeptimport · Einkaufsliste automatisch
        </div>
      </div>
    ),
    size,
  );
}
