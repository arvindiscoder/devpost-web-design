/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Allow agency logos from any https host (workspace.logo_url is user input).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  eslint: {
    // Surface lint errors during `next build` on Vercel.
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [
      {
        // The dashboard and portal must never be cached by an intermediary.
        source: "/:path(portal|dashboard|api|auth|login|signup)/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
