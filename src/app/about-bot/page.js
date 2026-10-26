import ProsePage from "@/components/Prose";

export const metadata = { title: "About our crawler", alternates: { canonical: "/about-bot" } };

export default function AboutBot() {
  return (
    <ProsePage title="About OfferFinderBot">
      <p>
        OfferFinderBot fetches individual public promotion pages that our team has submitted, and re-checks them periodically to confirm an offer is
        still valid.
      </p>
      <ul>
        <li>It identifies itself with the user agent <code>OfferFinderBot/0.1</code>.</li>
        <li>It obeys robots.txt. To opt out, add <code>User-agent: OfferFinderBot</code> followed by <code>Disallow: /</code>.</li>
        <li>It does not log in, solve CAPTCHAs or bypass access controls.</li>
        <li>It fetches single pages, not whole sites, and backs off when a server returns errors.</li>
      </ul>
    </ProsePage>
  );
}
