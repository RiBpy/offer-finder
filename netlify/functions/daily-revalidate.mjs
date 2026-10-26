// Netlify Scheduled Function: once a day, calls the app's revalidation
// endpoint (the Netlify equivalent of the cron in vercel.json).
// Needs CRON_SECRET set in Netlify's environment variables.

export default async () => {
  const base = process.env.URL; // set by Netlify to the site's main URL
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("daily-revalidate: URL or CRON_SECRET is missing");
    return;
  }
  const res = await fetch(`${base}/api/cron/revalidate`, { headers: { Authorization: `Bearer ${secret}` } });
  console.log("daily-revalidate:", res.status, await res.text());
};

export const config = { schedule: "0 3 * * *" };
