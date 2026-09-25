// Native map — full react-native-maps with markers and route polyline
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Colors, Radius, Shadow } from '../lib/theme';

export default function MapSection({
  mapRef,
  region,
  loadingMap,
  destination,
  destLabel,
  route,
  pois = [],
  safePoints = [],
  onPress,
  onLongPress
}) {
  return (
    <View style={styles.mapWrap}>
      {loadingMap ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.hint}>Getting your location…</Text>
        </View>
      ) : region ? (
        <MapView
          ref={mapRef}
          provider="google"
          style={styles.map}
          initialRegion={region}
          onPress={onPress}
          onLongPress={onLongPress}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {destination && (
            <Marker coordinate={destination} title="Destination" description={destLabel}>
              <View>
                <Ionicons name="location" size={32} color={Colors.danger} />
              </View>
            </Marker>
          )}
          {pois.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              title={p.name}
              description={p.type || 'Safety point'}
            >
              <View style={styles.policePin}>
                <Ionicons
                  name={p.type === 'hospital' ? 'medical' : 'shield-checkmark'}
                  size={16}
                  color={Colors.bg}
                />
              </View>
            </Marker>
          ))}
          {safePoints.map((s) => (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={s.type === 'safe' ? 'Safe Area' : 'Avoid Area'}
              description={s.comment}
            >
              <View style={[styles.safePin, s.type === 'avoid' && { backgroundColor: Colors.danger }]}>
                <Ionicons
                  name={s.type === 'safe' ? 'heart' : 'alert-circle'}
                  size={14}
                  color="#fff"
                />
              </View>
            </Marker>
          ))}
          {route.length > 1 && (
            <Polyline
              coordinates={route}
              strokeColor={Colors.primary}
              strokeWidth={4}
              lineDashPattern={[0]}
            />
          )}
        </MapView>
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="location-outline" size={28} color={Colors.textFaint} />
          <Text style={styles.hint}>Location permission needed.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap:     { height: '36%', marginHorizontal: 16, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card },
  map:         { flex: 1 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.bgAlt },
  hint:        { color: Colors.textMuted, fontSize: 13 },
  policePin: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bg,
  },
  safePin: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
});
