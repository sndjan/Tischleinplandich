import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Only the landing page is meant for search engines; the app itself needs an account.
    rules: { userAgent: "*", allow: "/", disallow: ["/meal-planner", "/auth/", "/api/", "/share-target", "/warteliste"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
