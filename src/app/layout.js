import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "OfferFinder: verified offers near you today", template: "%s · OfferFinder" },
  description: "Find currently valid offers, discounts and deals near your location, each linked to its original source.",
  alternates: { canonical: "/" },
};

export const viewport = { themeColor: "#047857" };

export default function RootLayout({ children }) {
  return (
    // Browser extensions (Grammarly, ColorZilla, …) add attributes to <html>/<body> before hydration,
    // and the theme script adds the "dark" class.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
