import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Client portals are private-by-token and must never be crawled.
        disallow: ["/portal/", "/dashboard/", "/auth/", "/api/", "/login", "/signup"],
      },
    ],
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
