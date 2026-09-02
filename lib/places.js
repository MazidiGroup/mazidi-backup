// Google Places (New) lookup: is this company visibly trading?
//
// Optional. If GOOGLE_PLACES_API_KEY is not set, every call returns
// { checked: false } and scoring carries on without it. One request per
// company; only the fields we score on are requested, which keeps it in the
// cheapest SKU.

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELDS = 'places.id,places.displayName,places.businessStatus,places.rating,places.userRatingCount,places.websiteUri,places.formattedAddress,places.reviews';

export async function placesLookup({ legalName, postcode, city }) {
  const key = (process.env.GOOGLE_PLACES_API_KEY || '').trim();
  if (!key) return { checked: false };

  const query = [legalName, postcode || city || 'London'].filter(Boolean).join(', ');
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELDS
      },
      body: JSON.stringify({ textQuery: query, regionCode: 'GB', maxResultCount: 3 }),
      signal: ctl.signal
    });
    if (!res.ok) return { checked: true, error: `Places ${res.status}` };
    const j = await res.json();
    const picked = pickMatch(j.places ?? [], legalName, postcode);
    if (!picked) return { checked: true, found: false, query };
    const { place: best, matchedBy } = picked;
    return {
      checked: true,
      found: true,
      query,
      placeId: best.id,
      matchedBy,                                       // 'name' | 'postcode' | 'both'
      name: best.displayName?.text ?? null,
      businessStatus: best.businessStatus ?? null,     // OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
      rating: best.rating ?? null,
      ratingCount: best.userRatingCount ?? 0,
      websiteUri: best.websiteUri ?? null,
      address: best.formattedAddress ?? null,
      // Newest of the reviews Google returns (up to five). A listing whose
      // newest review is years old is evidence of a business that has gone
      // quiet, even if the count looks healthy.
      latestReviewAt: newest((best.reviews ?? []).map(r => r.publishTime)),
      sourceUrl: `https://www.google.com/maps/place/?q=place_id:${best.id}`
    };
  } catch (e) {
    return { checked: true, error: e.name === 'AbortError' ? 'Places timeout' : e.message };
  } finally {
    clearTimeout(t);
  }
}

function newest(dates) {
  const ts = dates.map(d => Date.parse(d)).filter(Number.isFinite);
  return ts.length ? new Date(Math.max(...ts)).toISOString().slice(0, 10) : null;
}

// A text search returns nearest-plausible results even when the company has
// no listing. Only accept one whose name shares the company's distinctive
// words, or whose address carries the registered postcode.
const STOP = new Set(['limited','ltd','llp','the','and','uk','co','group','company','services','partnership','accountants','accountancy','bookkeeping']);
const words = s => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));

function pickMatch(places, legalName, postcode) {
  const want = words(legalName);
  const pc = (postcode || '').toLowerCase().replace(/\s+/g, '');
  for (const p of places) {
    const got = new Set(words(p.displayName?.text));
    const nameHit = want.length && want.every(w => got.has(w));
    const pcHit = pc && (p.formattedAddress || '').toLowerCase().replace(/\s+/g, '').includes(pc);
    if (nameHit || pcHit) return { place: p, matchedBy: nameHit && pcHit ? 'both' : nameHit ? 'name' : 'postcode' };
  }
  return null;
}
