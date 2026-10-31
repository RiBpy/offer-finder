"use client";

import { Analytics } from "@vercel/analytics/next";

// Visitors are counted with Vercel Web Analytics (no cookies). Admin pages are
// left out so your own moderation work does not inflate the numbers.
const skipAdmin = (event) => (new URL(event.url).pathname.startsWith("/admin") ? null : event);

export default function SiteAnalytics() {
  return <Analytics beforeSend={skipAdmin} />;
}
