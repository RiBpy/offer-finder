import ProsePage from "@/components/Prose";

export const metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <ProsePage title="Privacy policy" updated="25 October 2026">
      <p>
        This is a starting template written for the OfferFinder MVP. Have it reviewed for the laws that apply where you operate (for example GDPR,
        or Bangladesh&apos;s data protection rules) before launch.
      </p>
      <h2>No account needed</h2>
      <p>You can browse offers without creating an account. We do not ask for your name, email or phone number.</p>
      <h2>Your location</h2>
      <ul>
        <li>We ask for your location only to show offers near you, through your browser&apos;s permission prompt. You can refuse and choose a city instead.</li>
        <li>Coordinates are rounded to about 100 metres in your browser before they are sent to our server.</li>
        <li>Your selected location is kept in your browser&apos;s local storage. Our server uses it to answer the request and does not store it.</li>
        <li>To show an area name, rounded coordinates or your search text are sent to Google Maps Platform, under Google&apos;s privacy policy.</li>
      </ul>
      <h2>Saved offers</h2>
      <p>Saved offers are stored only in your browser. Clearing your browser data removes them.</p>
      <h2>Server logs</h2>
      <p>
        Like most websites, our hosting provider records technical request data (IP address, time, page requested) for security and rate limiting.
        These logs are kept for a limited period and are not used to profile you.
      </p>
      <h2>Cookies</h2>
      <p>The public site sets no tracking cookies. The administrator area uses one strictly necessary session cookie.</p>
      <h2>Offer data</h2>
      <p>
        Offers come from public business pages, campaign pages and news. We store a short summary, dates and a link to the original. We do not collect
        private social media content.
      </p>
      <h2>Contact</h2>
      <p>For privacy questions or to report an offer, contact the site operator at the address published on this site.</p>
    </ProsePage>
  );
}
