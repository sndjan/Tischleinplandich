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
    theme_color: "#ffffff",
    // Lets Android (and desktop Chrome) list the installed app in the share sheet.
    // public/sw.js receives the POST; /share-target handles it without the worker.
    share_target: {
      action: "/share-target",
      method: "post",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "files", accept: ["image/*", "application/pdf"] }],
      },
      // Next's type lists params as name/value pairs; browsers expect this shape.
    } as unknown as MetadataRoute.Manifest["share_target"],
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
