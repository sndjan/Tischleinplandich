import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wochen-Essensplaner",
    short_name: "Essensplaner",
    description:
      "Plane deine wöchentlichen Mahlzeiten und erstelle automatisch Einkaufslisten",
    lang: "de",
    start_url: "/meal-planner",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4f9c6e",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
