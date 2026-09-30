// Free "safety points" (police, hospitals, pharmacies, fire stations) from
// OpenStreetMap via the Overpass API - no API key, no billing.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const AMENITY_BY_KIND = {
  police: 'police',
  hospital: 'hospital',
  pharmacy: 'pharmacy',
  fire_station: 'fire_station',
};

export const KIND_LABEL = {
  police: 'Police',
  hospital: 'Hospital',
  pharmacy: 'Pharmacy',
  fire_station: 'Fire station',
};

const cache = new Map();

function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function queryOverpass(query) {
  let lastErr;
  for (const url of ENDPOINTS) {
    try {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 15000) : null;
      const res = await fetch(url, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: ctrl?.signal,
      });
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Could not reach the places service.');
}

// kinds: any of 'police' | 'hospital' | 'pharmacy' | 'fire_station'
// Returns places sorted nearest-first, each with distanceMeters.
export async function findSafePlaces(point, radius = 2000, kinds = ['police', 'hospital']) {
  const amenities = kinds.map((k) => AMENITY_BY_KIND[k]).filter(Boolean);
  const key = `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}:${radius}:${amenities.join('|')}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value;

  const query =
    `[out:json][timeout:20];` +
    `nwr["amenity"~"^(${amenities.join('|')})$"](around:${radius},${point.latitude},${point.longitude});` +
    `out center 60;`;
  const data = await queryOverpass(query);

  const places = (data.elements || [])
    .map((el) => {
      const latitude = el.lat ?? el.center?.lat;
      const longitude = el.lon ?? el.center?.lon;
      if (latitude == null || longitude == null) return null;
      const type = el.tags?.amenity;
      return {
        id: `${el.type}-${el.id}`,
        name: el.tags?.name || `${KIND_LABEL[type] || 'Safe place'} (unnamed)`,
        type,
        latitude,
        longitude,
        distanceMeters: distanceMeters(point, { latitude, longitude }),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  cache.set(key, { at: Date.now(), value: places });
  return places;
}
