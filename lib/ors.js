// -----------------------------------------------------------------------
// OpenRouteService (openrouteservice.org) client.
// Needs EXPO_PUBLIC_ORS_API_KEY in your .env (already present in this
// project). ORS is free for personal/dev use up to a daily quota.
// -----------------------------------------------------------------------

const ORS_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY;
const ORS_BASE = 'https://api.openrouteservice.org';

// OpenRouteService POI category_id for "police" (group: public_places).
// Reference: https://giscience.github.io/openrouteservice/api-reference/endpoints/poi/
const CATEGORY_POLICE = 369;

function assertKey() {
  if (!ORS_KEY) {
    throw new Error('Missing EXPO_PUBLIC_ORS_API_KEY - add it to your .env and restart Expo.');
  }
}

// -----------------------------------------------------------------------
// Tiny in-memory TTL cache so repeated searches/police lookups for the
// same (or near-identical) input don't re-hit ORS's rate-limited free
// tier. Keyed by a rounded/normalized string, so "coffee" typed twice in
// a row, or two police lookups a few meters apart, reuse one response.
// -----------------------------------------------------------------------
const cache = new Map(); // key -> { value, expiresAt }

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  // Opportunistic cleanup so the map doesn't grow unbounded during a long session.
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) if (now > v.expiresAt) cache.delete(k);
  }
}

// Round a lat/lng to ~50-100m precision so nearby lookups share a cache entry.
function roundCoord(n) {
  return Math.round(n * 1000) / 1000; // ~111m at the equator
}

// A real pedestrian route (follows footpaths/roads) between two points -
// this is what makes "safe route" mean something more than a straight
// line through buildings: it's the actual walkable path.
export async function getWalkingRoute(from, to) {
  assertKey();
  const res = await fetch(`${ORS_BASE}/v2/directions/foot-walking/geojson`, {
    method: 'POST',
    headers: {
      Authorization: ORS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: [
        [from.longitude, from.latitude],
        [to.longitude, to.latitude],
      ],
    }),
  });
  if (!res.ok) throw new Error(`ORS directions failed (${res.status})`);
  const data = await res.json();
  const feature = data?.features?.[0];
  const coords = feature?.geometry?.coordinates ?? [];
  const summary = feature?.properties?.summary; // { distance (m), duration (s) }
  return {
    route: coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
    distanceMeters: summary?.distance ?? null,
    durationSeconds: summary?.duration ?? null,
  };
}

// Destination search-as-you-type (replaces plain Nominatim search with
// ORS's own geocoder, biased toward the user's current location).
export async function searchPlaces(query, focus) {
  assertKey();
  const trimmed = query.trim().toLowerCase();
  const cacheKey = `search:${trimmed}:${focus ? `${roundCoord(focus.latitude)},${roundCoord(focus.longitude)}` : 'nofocus'}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ api_key: ORS_KEY, text: query, size: '8' });
  if (focus) {
    params.set('focus.point.lon', String(focus.longitude));
    params.set('focus.point.lat', String(focus.latitude));
  }
  const res = await fetch(`${ORS_BASE}/geocode/autocomplete?${params.toString()}`);
  if (!res.ok) throw new Error(`ORS geocode failed (${res.status})`);
  const data = await res.json();
  const results = (data?.features ?? []).map((f) => ({
    id: f.properties.id || `${f.geometry.coordinates.join(',')}`,
    label: f.properties.label,
    layer: f.properties.layer, // 'venue' (shop/POI), 'street', 'address', 'locality', etc.
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
  }));
  cacheSet(cacheKey, results, 60_000); // search results go stale fast enough at 60s
  return results;
}

// Police stations within `radiusMeters` of a point - used for the "Nearby
// Police" safety layer and to suggest a safe waypoint if a walk goes bad.
export async function findNearbyPolice(point, radiusMeters = 1500) {
  assertKey();
  const cacheKey = `police:${roundCoord(point.latitude)},${roundCoord(point.longitude)}:${radiusMeters}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${ORS_BASE}/pois`, {
    method: 'POST',
    headers: {
      Authorization: ORS_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      request: 'pois',
      sortby: 'distance',
      geometry: {
        geojson: { type: 'Point', coordinates: [point.longitude, point.latitude] },
        buffer: radiusMeters,
      },
      filters: { category_ids: [CATEGORY_POLICE] },
    }),
  });
  if (!res.ok) throw new Error(`ORS POI search failed (${res.status})`);
  const data = await res.json();
  const results = (data?.features ?? []).map((f) => ({
    id: String(f.properties.osm_id ?? `${f.geometry.coordinates.join(',')}`),
    name: f.properties.osm_tags?.name || 'Police station',
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
    distanceMeters: f.properties.distance ?? null,
  }));
  cacheSet(cacheKey, results, 5 * 60_000); // police stations don't move - cache longer
  return results;
}
