import ProsePage from "@/components/Prose";

export const metadata = { title: "Terms of use", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <ProsePage title="Terms of use" updated="25 October 2026">
      <p>This is a starting template for the OfferFinder MVP. Have it reviewed before launch.</p>
      <h2>What OfferFinder is</h2>
      <p>
        OfferFinder lists promotions published by businesses and media, and links to the original source. We are not the seller and are not party to
        any purchase.
      </p>
      <h2>Accuracy</h2>
      <ul>
        <li>We show an offer as Active only when its validity is supported by the source, and we hide offers once their stated end date passes.</li>
        <li>Businesses can change or withdraw offers at any time. Always confirm the price, terms and participating branches with the business.</li>
        <li>Offers marked Unverified could not be confirmed and may no longer be valid.</li>
      </ul>
      <h2>Content and trademarks</h2>
      <p>
        Brand names, logos and images belong to their owners and are shown only to identify the offer. If you own content shown here and want it
        changed or removed, contact us and we will act promptly.
      </p>
      <h2>Acceptable use</h2>
      <p>Do not scrape, overload or attempt to access the administrator area of this site.</p>
      <h2>Liability</h2>
      <p>The service is provided as is. To the extent permitted by law, we are not liable for losses arising from reliance on a listed offer.</p>
    </ProsePage>
  );
}
