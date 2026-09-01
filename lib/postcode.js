// postcodes.io — free, no key, no rate limit worth worrying about.
const BASE = 'https://api.postcodes.io';

async function get(path) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(BASE + path, { signal: ctl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.result ?? null;
  } catch { return null; } finally { clearTimeout(t); }
}

export async function lookup(postcode) {
  if (!postcode) return null;
  const clean = postcode.replace(/\s+/g, '').toUpperCase();
  return get(`/postcodes/${encodeURIComponent(clean)}`);
}

// Great-circle distance in miles.
export function milesBetween(a, b) {
  if (!a || !b) return null;
  const R = 3958.8, rad = d => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
}
