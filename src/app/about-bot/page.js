import ProsePage from "@/components/Prose";

export const metadata = { title: "About our crawler", alternates: { canonical: "/about-bot" } };

export default function AboutBot() {
  return (
    <ProsePage title="About OfferFinderBot">
      <p>
        OfferFinderBot reads public news feeds and the offer pages businesses publish, picks out current promotions, and re-checks them periodically
        to confirm an offer is still valid. Every listing links back to its original source.
      </p>
      <ul>
        <li>It identifies itself with the user agent <code>OfferFinderBot/0.1</code>.</li>
        <li>It obeys robots.txt. To opt out, add <code>User-agent: OfferFinderBot</code> followed by <code>Disallow: /</code>.</li>
        <li>It does not log in, solve CAPTCHAs or bypass access controls.</li>
        <li>It fetches feeds, offer listing pages and the articles they link to, not whole sites, and backs off when a server returns errors.</li>
      </ul>
    </ProsePage>
  );
}
