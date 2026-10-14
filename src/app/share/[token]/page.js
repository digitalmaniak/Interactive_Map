import ShareView from "../../../components/share/ShareView";
import { fetchSharedTrip } from "../../../lib/journeys/shareServer";
import { countsLine, shareLegs, tripDates } from "../../../lib/journeys/shareItinerary";

// Unlisted share link. The view-only globe renders on the client. Metadata reads the trip
// on the server with the anon key and the share token. A private or deleted trip gets
// plain Odyssey tags with no trip data. og:image comes from opengraph-image.js.
const PLAIN = "A trip shared from Odyssey.";

export async function generateMetadata({ params }) {
  const { token } = await params;
  const trip = await fetchSharedTrip(token);
  const image = { url: `/share/${encodeURIComponent(token)}/opengraph-image`, width: 1200, height: 630 };
  let title = "Odyssey", description = PLAIN;
  if (trip) {
    const legs = shareLegs(trip.legs, trip.pins);
    title = trip.journey.title || "Odyssey";
    description = [tripDates(trip.journey), countsLine(legs)].filter(Boolean).join(". ") || PLAIN;
  }
  return {
    title: trip ? `${title} | Odyssey` : title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "Odyssey", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function SharedJourneyPage({ params }) {
  const { token } = await params;
  return <ShareView token={token} />;
}
