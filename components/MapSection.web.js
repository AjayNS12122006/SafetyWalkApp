// Web map — a real live Leaflet map (loaded from CDN, same as the backend's
// /view share page), not just a static snapshot. Mirrors the native map's
// features: live position marker, destination pin, route line, police POIs.
import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Shadow } from '../lib/theme';

let leafletPromise = null;
function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return leafletPromise;
}

export default function MapSection({
  region, loadingMap, myLocation, destination, destLabel, route = [], pois = [], safePoints = [], onPress, onLongPress,
}) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const meMarkerRef   = useRef(null);
  const destMarkerRef = useRef(null);
  const routeLineRef  = useRef(null);
  const poiMarkersRef = useRef([]);
  const safeMarkersRef = useRef([]);

  // Create the map once we know where we are.
  useEffect(() => {
    if (!region || loadingMap || !containerRef.current) return;
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !L || mapRef.current) return;
      mapRef.current = L.map(containerRef.current).setView([region.latitude, region.longitude], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);
      if (onPress) {
        mapRef.current.on('click', (e) =>
          onPress({ nativeEvent: { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } } })
        );
      }
      if (onLongPress) {
        mapRef.current.on('contextmenu', (e) => {
           e.originalEvent.preventDefault();
           onLongPress({ nativeEvent: { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } } });
        });
      }
    });
    return () => { cancelled = true; };
  }, [!!region, loadingMap]);

  useEffect(() => () => {
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
  }, []);

  // Live "you are here" marker - updates as myLocation changes during a walk.
  useEffect(() => {
    const L = window.L;
    if (!mapRef.current || !L || !myLocation) return;
    if (!meMarkerRef.current) {
      meMarkerRef.current = L.circleMarker([myLocation.latitude, myLocation.longitude], {
        radius: 8, weight: 3, color: '#fff', fillColor: Colors.primary, fillOpacity: 1,
      }).addTo(mapRef.current).bindPopup('You');
    } else {
      meMarkerRef.current.setLatLng([myLocation.latitude, myLocation.longitude]);
    }
    mapRef.current.panTo([myLocation.latitude, myLocation.longitude]);
  }, [myLocation?.latitude, myLocation?.longitude]);

  // Destination pin.
  useEffect(() => {
    const L = window.L;
    if (!mapRef.current || !L) return;
    if (destMarkerRef.current) { mapRef.current.removeLayer(destMarkerRef.current); destMarkerRef.current = null; }
    if (destination) {
      destMarkerRef.current = L.marker([destination.latitude, destination.longitude])
        .addTo(mapRef.current)
        .bindPopup(destLabel || 'Destination');
    }
  }, [destination?.latitude, destination?.longitude]);

  // Walking route line.
  useEffect(() => {
    const L = window.L;
    if (!mapRef.current || !L) return;
    if (routeLineRef.current) { mapRef.current.removeLayer(routeLineRef.current); routeLineRef.current = null; }
    if (route.length > 1) {
      routeLineRef.current = L.polyline(
        route.map((r) => [r.latitude, r.longitude]),
        { color: Colors.primary, weight: 4 }
      ).addTo(mapRef.current);
    }
  }, [route]);

  // Nearby safety points markers (Police, etc).
  useEffect(() => {
    const L = window.L;
    if (!mapRef.current || !L) return;
    poiMarkersRef.current.forEach((m) => mapRef.current.removeLayer(m));
    poiMarkersRef.current = pois.map((p) =>
      L.circleMarker([p.latitude, p.longitude], {
        radius: 7, weight: 2, color: '#fff', fillColor: p.type === 'hospital' ? Colors.accent : Colors.primary, fillOpacity: 1,
      }).addTo(mapRef.current).bindPopup(`${p.name} (${p.type || 'Safety point'})`)
    );
  }, [pois]);

  // User safety reports.
  useEffect(() => {
    const L = window.L;
    if (!mapRef.current || !L) return;
    safeMarkersRef.current.forEach((m) => mapRef.current.removeLayer(m));
    safeMarkersRef.current = safePoints.map((s) =>
      L.circleMarker([s.lat, s.lng], {
        radius: 6, weight: 2, color: '#fff', fillColor: s.type === 'avoid' ? Colors.danger : Colors.accent, fillOpacity: 1,
      }).addTo(mapRef.current).bindPopup(`${s.type === 'safe' ? 'Safe' : 'Avoid'}: ${s.comment || ''}`)
    );
  }, [safePoints]);

  return (
    <View style={styles.mapWrap}>
      {loadingMap ? (
        <View style={styles.placeholder}>
          <Text style={styles.hint}>Getting your location…</Text>
        </View>
      ) : region ? (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="map-outline" size={28} color={Colors.textFaint} />
          <Text style={styles.hint}>Location permission needed.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: '36%',
    marginHorizontal: 16,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.card,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.bgAlt,
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
