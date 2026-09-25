import { API_BASE_URL } from './config';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function findNearbyPlaces(location, radius = 2000, types = ['police', 'hospital', 'pharmacy']) {
  if (!GOOGLE_MAPS_KEY) {
    console.warn('Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
    return [];
  }

  // Note: For a real app, you might want to proxy this through your backend
  // to avoid exposing your API key in the client bundle.
  const typeQuery = types.join('|');
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.latitude},${location.longitude}&radius=${radius}&type=${typeQuery}&key=${GOOGLE_MAPS_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return [];

    return data.results.map(p => ({
      id: p.place_id,
      name: p.name,
      latitude: p.geometry.location.lat,
      longitude: p.geometry.location.lng,
      type: p.types[0],
      vicinity: p.vicinity,
    }));
  } catch (e) {
    console.error('Google Places search failed', e);
    return [];
  }
}

// Safety-aware routing: this would ideally weight routes by safe/avoid areas.
// For now, we fetch the standard walking route and can augment it with
// safety markers from our backend.
export async function getGoogleWalkingRoute(from, to) {
  if (!GOOGLE_MAPS_KEY) {
     throw new Error('Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&mode=walking&key=${GOOGLE_MAPS_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') throw new Error(`Google Directions failed: ${data.status}`);

    const route = data.routes[0];
    const points = decodePolyline(route.overview_polyline.points);

    return {
      route: points,
      distanceMeters: route.legs[0].distance.value,
      durationSeconds: route.legs[0].duration.value,
      summary: route.summary,
    };
  } catch (e) {
    console.error('Google Directions failed', e);
    throw e;
  }
}

// Helper to decode Google's polyline format
function decodePolyline(encoded) {
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ latitude: (lat / 1e5), longitude: (lng / 1e5) });
  }
  return points;
}
