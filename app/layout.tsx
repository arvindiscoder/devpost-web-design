import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { ToasterProvider } from "@/components/toaster-provider";
import { env } from "@/lib/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: "ClientSync — passwordless client approvals for freelancers",
    template: "%s · ClientSync",
  },
  description:
    "ClientSync is a zero-cost, passwordless client portal. Share deliverables, collect approvals and revision requests in two clicks — no client account ever required.",
  keywords: [
    "client portal",
    "freelance",
    "agency",
    "deliverable approval",
    "passwordless",
    "client feedback",
    "supabase",
    "nextjs",
  ],
  authors: [{ name: "ClientSync" }],
  openGraph: {
    type: "website",
    title: "ClientSync — passwordless client approvals",
    description:
      "Share deliverables, collect approvals and revision requests in two clicks. Runs entirely on free tiers.",
    siteName: "ClientSync",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClientSync — passwordless client approvals",
    description:
      "A $0 client portal for freelancers and agencies. No client account required.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} font-sans`}>
        {children}
        <ToasterProvider />
      </body>
    </html>
  );
}
