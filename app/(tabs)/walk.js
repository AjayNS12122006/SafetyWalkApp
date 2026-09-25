import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapSection from '../../components/MapSection';
import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import { api } from '../../lib/api';
import { getSocket, joinWalk } from '../../lib/socket';
import { sendSOS } from '../../lib/sos';
import { getContacts, getSession } from '../../lib/storage';
import { Colors, Radius, Shadow } from '../../lib/theme';
import { getWalkingRoute, searchPlaces } from '../../lib/ors';
import { findNearbyPlaces, getGoogleWalkingRoute } from '../../lib/googleMaps';
import { shareToWhatsApp } from '../../lib/whatsapp';

const ETA_OPTIONS = [10, 20, 30, 45, 60];
const PUSH_INTERVAL_MS = 6000;

// Google Maps shows a different pin per result type (shop vs street vs
// area) - this mirrors that using ORS/Pelias's `layer` field.
function resultIcon(layer) {
  switch (layer) {
    case 'venue':   return 'storefront-outline';   // shops, restaurants, POIs
    case 'street':  return 'trail-sign-outline';
    case 'address': return 'home-outline';
    default:        return 'location-outline';     // locality, region, etc.
  }
}

export default function Walk() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [session, setSession]     = useState(null);
  const [contacts, setContacts]   = useState([]);
  const [selected, setSelected]   = useState({});
  const [region, setRegion]       = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [destination, setDestination]   = useState(null);
  const [destLabel, setDestLabel]       = useState('');
  const [etaMinutes, setEtaMinutes]     = useState(20);
  const [customEta, setCustomEta]       = useState('');
  const [loadingMap, setLoadingMap]     = useState(true);

  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const searchDebounce = useRef(null);

  const [walkActive, setWalkActive] = useState(false);
  const [walk, setWalk]             = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [starting, setStarting]     = useState(false);
  const [route, setRoute]           = useState([]);
  const [routeInfo, setRouteInfo]   = useState(null); // { distanceMeters, durationSeconds }

  const [policeStations, setPoliceStations] = useState([]);
  const [showPolice, setShowPolice]         = useState(false);
  const [loadingPolice, setLoadingPolice]   = useState(false);
  const [isSilent, setIsSilent]           = useState(false);
  const [safePoints, setSafePoints]       = useState([]);

  const tickRef     = useRef(null);
  const pushRef     = useRef(null);
  const mapRef      = useRef(null);
  const locationRef = useRef(null);
  const myLocationRef = useRef(null);
  useEffect(() => { myLocationRef.current = myLocation; }, [myLocation]);

  const loadData = useCallback(async () => {
    const s = await getSession();
    if (!s) { router.replace('/login'); return; }
    setSession(s);
    const c = await getContacts();
    setContacts(c ?? []);
    setSelected(Object.fromEntries((c ?? []).map((ct) => [ct.id, true])));
  }, []);

  useEffect(() => {
    (async () => {
      await loadData();
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setMyLocation(coords);
          setRegion({ ...coords, latitudeDelta: 0.012, longitudeDelta: 0.012 });

          // Fetch nearby safety reports
          try {
             const { data } = await api.get('/safety/nearby', { params: { lat: coords.latitude, lng: coords.longitude, radius: 5 } });
             setSafePoints(data.reports || []);
          } catch (e) { console.warn('Could not load safety reports', e); }

          locationRef.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 8 },
            (update) => {
              setMyLocation({ latitude: update.coords.latitude, longitude: update.coords.longitude });
            }
          );
        }
      } finally {
        setLoadingMap(false);
      }
    })();

    const socket = getSocket();
    const onAutoSos = () =>
      Alert.alert('Auto-SOS sent', 'You missed your check-in. Your contacts have been alerted.');

    const onSosWarning = ({ secondsLeft }) => {
      Alert.alert(
        'Are you safe?',
        `Your walk ETA is almost up (${Math.round(secondsLeft / 60)} min left). Tap "I'm Safe" to cancel the auto-SOS.`,
        [{ text: 'I am safe', onPress: arrivedSafely }]
      );
    };

    socket.on('sos:auto', onAutoSos);
    socket.on('sos:warning', onSosWarning);

    return () => {
      socket.off('sos:auto', onAutoSos);
      socket.off('sos:warning', onSosWarning);
      clearInterval(tickRef.current);
      clearInterval(pushRef.current);
      locationRef.current?.remove?.();
    };
  }, [loadData]);

  useFocusEffect(useCallback(() => { if (!walkActive) loadData(); }, [loadData, walkActive]));

  // "Walk Me Home" (or any other screen) can deep-link in with a destination
  // already chosen via router params, so the user doesn't have to search again.
  useEffect(() => {
    if (params?.destLat && params?.destLng && !destination) {
      const coords = { latitude: parseFloat(params.destLat), longitude: parseFloat(params.destLng) };
      setDestination(coords);
      setDestLabel(params.destLabel ? String(params.destLabel) : 'Home');
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500);
    }
  }, [params?.destLat, params?.destLng]);

  useEffect(() => {
    if (myLocation && destination) fetchRoute(myLocation, destination);
    setPoliceStations([]);
    setShowPolice(false);
  }, [myLocation, !!destination]);

  // ── Destination search (debounced, OpenRouteService geocoder) ──
  useEffect(() => {
    clearTimeout(searchDebounce.current);
    if (searchQuery.trim().length < 3) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchPlaces(searchQuery, myLocation);
        setSearchResults(results);
      } catch { setSearchResults([]); }
      finally  { setSearching(false); }
    }, 450);
    return () => clearTimeout(searchDebounce.current);
  }, [searchQuery, myLocation]);

  const pickResult = (item) => {
    const coords = { latitude: item.latitude, longitude: item.longitude };
    setDestination(coords);
    setDestLabel(item.label);
    setSearchQuery('');
    setSearchResults([]);
    mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500);
  };

  const handleMapPress = (e) => {
    if (walkActive) return;
    const coords = e.nativeEvent.coordinate;
    setDestination(coords);
    setDestLabel(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
  };

  const handleMapLongPress = (e) => {
    const coords = e.nativeEvent.coordinate;
    Alert.alert(
      'Report safety for this spot',
      'Mark this area for other users.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Safe',
          onPress: () => submitSafetyReport('safe', coords)
        },
        {
          text: 'Avoid Area',
          onPress: () => submitSafetyReport('avoid', coords)
        }
      ]
    );
  };

  const submitSafetyReport = async (type, coords) => {
    try {
      await api.post('/safety/report', {
        type,
        lat: coords.latitude,
        lng: coords.longitude,
        comment: type === 'safe' ? 'Well-lit area' : 'Isolated shortcut'
      });
      // Refresh safe points
      const { data } = await api.get('/safety/nearby', { params: { lat: coords.latitude, lng: coords.longitude, radius: 5 } });
      setSafePoints(data.reports || []);
      Alert.alert('Report saved', `Area marked as ${type}.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // Real pedestrian route (follows footpaths/roads) via Google Maps or OpenRouteService -
  // this is the "safe route", as opposed to a straight line through buildings.
  const fetchRoute = async (from, to) => {
    try {
      // Prefer Google for better pedestrian pathing
      const { route: coords, distanceMeters, durationSeconds } = await getGoogleWalkingRoute(from, to);
      setRoute(coords);
      setRouteInfo({ distanceMeters, durationSeconds });
    } catch (googleError) {
      console.warn('Google routing failed, trying ORS fallback', googleError);
      try {
        const { route: coords, distanceMeters, durationSeconds } = await getWalkingRoute(from, to);
        setRoute(coords);
        setRouteInfo({ distanceMeters, durationSeconds });
      } catch (orsError) {
        setRoute([]);
        setRouteInfo(null);
      }
    }
  };

  const toggleNearbyPolice = async () => {
    if (showPolice) { setShowPolice(false); return; }
    setShowPolice(true);
    if (policeStations.length > 0) return;
    const around = destination || myLocation;
    if (!around) return;
    setLoadingPolice(true);
    try {
      const stations = await findNearbyPlaces(around, 2000, ['police', 'hospital', 'pharmacy']);
      setPoliceStations(stations);
      if (stations.length === 0) {
        Alert.alert('No safety points found', 'None within 2km of this area.');
      }
    } catch (e) {
      Alert.alert('Could not load safety points', e.message);
      setShowPolice(false);
    } finally {
      setLoadingPolice(false);
    }
  };

  const routeToNearestSafePlace = async () => {
    if (!myLocation) return;
    setLoadingPolice(true);
    try {
      const places = await findNearbyPlaces(myLocation, 3000, ['police', 'hospital']);
      if (places.length === 0) {
        Alert.alert('None found', 'No police or hospitals within 3km.');
        return;
      }
      const nearest = places[0]; // Already sorted by distance usually
      setDestination({ latitude: nearest.latitude, longitude: nearest.longitude });
      setDestLabel(`Safe: ${nearest.name}`);
      mapRef.current?.animateToRegion({
        latitude: nearest.latitude,
        longitude: nearest.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012
      }, 500);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoadingPolice(false);
    }
  };


  const toggleContact = (id) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  const selectedContacts = contacts.filter((c) => selected[c.id]);

  const activeEta = customEta ? parseInt(customEta, 10) || etaMinutes : etaMinutes;

  const startWalk = async () => {
    if (!destination) {
      Alert.alert('Pick a destination', 'Search above or tap the map to drop a pin.');
      return;
    }
    if (selectedContacts.length === 0) {
      Alert.alert('Select contacts', 'Choose at least one person to share your walk with.');
      return;
    }
    setStarting(true);
    try {
      const { data } = await api.post('/walks/start', {
        destinationLabel: destLabel,
        destLat: destination.latitude,
        destLng: destination.longitude,
        etaMinutes: activeEta,
        contactIds: selectedContacts.map((c) => c.id),
      });

      // Share the live-tracking link via SMS to trusted contacts.
      const msg =
        `${session.name} started a SafetyWalk.\n` +
        `Expected arrival: ${activeEta} min.\n` +
        `Watch live: ${data.shareUrl}\n` +
        `Auto-alert fires if they don't check in on time.`;
      const nums     = selectedContacts.map((c) => c.phone).filter(Boolean);
      const sep      = Platform.OS === 'ios' ? '&' : ';';
      const smsUrl   = `sms:${nums.join(sep)}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(msg)}`;
      if (await Linking.canOpenURL(smsUrl)) await Linking.openURL(smsUrl);

      joinWalk(data.walk.shareToken);
      setWalk({ ...data.walk, shareUrl: data.shareUrl });
      setWalkActive(true);
      beginTracking(data.walk);
    } catch (e) {
      Alert.alert('Could not start walk', e.message);
    } finally {
      setStarting(false);
    }
  };

  const beginTracking = (activeWalk) => {
    const tick = () => {
      const left = Math.max(0, Math.round((activeWalk.deadlineAt - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    tickRef.current = setInterval(tick, 1000);

    pushRef.current = setInterval(async () => {
      const loc = myLocationRef.current;
      if (!loc) return;
      try {
        await api.post(`/walks/${activeWalk.id}/location`, loc);
      } catch { /* silent retry next tick */ }
    }, PUSH_INTERVAL_MS);
  };

  const stopTracking = () => {
    clearInterval(tickRef.current);
    clearInterval(pushRef.current);
  };

  const arrivedSafely = async () => {
    Alert.alert(
      'Arrived safely?',
      'This cancels the auto-SOS timer and lets your contacts know you made it.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Yes, I\'m safe!',
          onPress: async () => {
            stopTracking();
            setWalkActive(false);
            try { await api.post(`/walks/${walk.id}/arrive`); } catch { /* non-fatal */ }
            Alert.alert('Great!', 'Auto-SOS cancelled. Your contacts know you arrived safely.');
          },
        },
      ]
    );
  };

  const manualSOS = () => {
    if (isSilent) {
      // Discreetly send without big confirmation
      (async () => {
        try {
          if (walk) await api.post(`/walks/${walk.id}/sos`);
          await sendSOS({ contacts: selectedContacts, userName: session?.name, reason: 'SILENT SOS' });
          stopTracking();
          setWalkActive(false);
          Alert.alert('Sent', 'Emergency alert sent silently.');
        } catch (e) {
          Alert.alert('SOS error', e.message);
        }
      })();
      return;
    }

    Alert.alert(
      '🚨 Send SOS now?',
      'This immediately alerts your contacts with your current location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              if (walk) await api.post(`/walks/${walk.id}/sos`);
              await sendSOS({ contacts: selectedContacts, userName: session?.name, reason: 'SOS' });
              stopTracking();
              setWalkActive(false);
              // After loud SOS, we might want to open the SOS strobe screen
              router.push('/sos');
            } catch (e) {
              Alert.alert('SOS error', e.message);
            }
          },
        },
      ]
    );
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const timerColor = secondsLeft < 120 ? Colors.danger : secondsLeft < 300 ? Colors.warning : Colors.accent;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {walkActive ? '🟡 Walk in progress' : 'Start a Safety Walk'}
        </Text>
        {walkActive && (
          <View style={styles.liveChip}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>

      {/* ── Search bar (pre-walk only) ── */}
      {!walkActive && (
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={Colors.textFaint} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search for a destination…"
              placeholderTextColor={Colors.textFaint}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searching
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : searchQuery.length > 0 &&
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <Ionicons name="close-circle" size={16} color={Colors.textFaint} />
                </TouchableOpacity>
            }
          </View>
          {searchResults.length > 0 && (
            <FlatList
              style={styles.resultsList}
              data={searchResults}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => pickResult(item)}>
                  <Ionicons name={resultIcon(item.layer)} size={15} color={Colors.accent} />
                  <Text style={styles.resultText} numberOfLines={2}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* ── Map ── */}
     <MapSection
  mapRef={mapRef}
  region={region}
  loadingMap={loadingMap}
  myLocation={myLocation}
  destination={destination}
  destLabel={destLabel}
  route={route}
  pois={showPolice ? policeStations : []}
  safePoints={safePoints}
  onPress={handleMapPress}
  onLongPress={handleMapLongPress}
/>
      {/* ── Bottom panel ── */}
      {walkActive ? (
        // Active walk panel
        <View style={styles.activePanel}>
          <Text style={styles.timerLabel}>Auto-SOS fires in</Text>
          <Text style={[styles.timer, { color: timerColor }]}>{mm}:{ss}</Text>
          <Text style={styles.timerSub}>
            Sharing with {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} · server-side timer
          </Text>
          <View style={styles.activeBtns}>
            <TouchableOpacity style={styles.arrivedBtn} onPress={arrivedSafely} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.bg} />
              <Text style={styles.arrivedBtnText}>I've Arrived Safely</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sosTinyBtn, isSilent && styles.silentBtn]}
              onPress={manualSOS}
            >
              <Ionicons name={isSilent ? 'eye-off' : 'alert-circle'} size={16} color={isSilent ? Colors.textMuted : Colors.danger} />
              <Text style={[styles.sosTinyText, isSilent && styles.silentText]}>
                {isSilent ? 'Silent SOS' : 'Send SOS'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.silentToggle}
            onPress={() => setIsSilent(!isSilent)}
          >
            <Ionicons name={isSilent ? 'checkbox' : 'square-outline'} size={18} color={Colors.primary} />
            <Text style={styles.silentToggleText}>Silent Mode (discreet alert)</Text>
          </TouchableOpacity>
          {walk?.shareUrl && (
            <>
              <TouchableOpacity
                style={styles.shareRow}
                onPress={() => Linking.openURL(walk.shareUrl)}
              >
                <Ionicons name="link-outline" size={14} color={Colors.primary} />
                <Text style={styles.shareText} numberOfLines={1}>Live tracking link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shareRow, styles.whatsappRow]}
                onPress={() =>
                  shareToWhatsApp(
                    `${session?.name || 'Someone'} is on a SafetyWalk.\nWatch live: ${walk.shareUrl}`
                  )
                }
              >
                <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                <Text style={[styles.shareText, { color: '#25D366' }]} numberOfLines={1}>
                  Share on WhatsApp
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        // Setup panel
        <ScrollView style={styles.panel} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          {/* Destination label */}
          {destLabel ? (
            <View style={styles.destChip}>
              <Ionicons name="navigate" size={14} color={Colors.accent} />
              <Text style={styles.destChipText} numberOfLines={1}>{destLabel}</Text>
              <TouchableOpacity onPress={() => { setDestination(null); setDestLabel(''); setRoute([]); setRouteInfo(null); }}>
                <Ionicons name="close-circle" size={16} color={Colors.textFaint} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.mapTip}>
              <Ionicons name="information-circle-outline" size={13} color={Colors.textFaint} />
              {'  '}Search above or tap the map to set your destination.
            </Text>
          )}

          {routeInfo?.distanceMeters != null && (
            <View style={styles.routeInfoRow}>
              <Ionicons name="walk-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.routeInfoText}>
                {(routeInfo.distanceMeters / 1000).toFixed(1)} km on foot · about{' '}
                {Math.max(1, Math.round(routeInfo.durationSeconds / 60))} min · safest walking route
              </Text>
            </View>
          )}

          {/* Nearby police */}
          <View style={styles.safetyActionRow}>
            <TouchableOpacity style={styles.policeToggle} onPress={toggleNearbyPolice} activeOpacity={0.85}>
              <Ionicons name="shield-outline" size={16} color={Colors.primary} />
              <Text style={styles.policeToggleText}>
                {showPolice ? 'Hide Safety Points' : 'Show Safety Points'}
              </Text>
              {loadingPolice && <ActivityIndicator size="small" color={Colors.primary} />}
            </TouchableOpacity>

            {!walkActive && (
              <TouchableOpacity
                style={[styles.policeToggle, { marginLeft: 8, borderColor: Colors.accent }]}
                onPress={routeToNearestSafePlace}
                activeOpacity={0.85}
              >
                <Ionicons name="medical" size={16} color={Colors.accent} />
                <Text style={[styles.policeToggleText, { color: Colors.accent }]}>
                  Nearest Safe Place
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {showPolice && policeStations.length > 0 && (
            <View style={styles.policeList}>
              {policeStations.slice(0, 4).map((p) => (
                <View key={p.id} style={styles.policeRow}>
                  <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
                  <Text style={styles.policeName} numberOfLines={1}>{p.name}</Text>
                  {p.distanceMeters != null && (
                    <Text style={styles.policeDistance}>{Math.round(p.distanceMeters)} m</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* ETA */}
          <Text style={styles.label}>Expected arrival time</Text>
          <View style={styles.etaRow}>
            {ETA_OPTIONS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.etaChip, activeEta === m && !customEta && styles.etaChipOn]}
                onPress={() => { setEtaMinutes(m); setCustomEta(''); }}
              >
                <Text style={[styles.etaChipText, activeEta === m && !customEta && styles.etaChipTextOn]}>
                  {m} min
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.etaCustomWrap}>
              <TextInput
                value={customEta}
                onChangeText={setCustomEta}
                placeholder="custom"
                placeholderTextColor={Colors.textFaint}
                keyboardType="number-pad"
                style={styles.etaCustom}
              />
            </View>
          </View>

          {/* Contact selection */}
          <Text style={styles.label}>Share with</Text>
          {contacts.length === 0 ? (
            <TouchableOpacity style={styles.emptyContacts} onPress={() => router.push('/(tabs)/contacts')}>
              <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
              <Text style={styles.emptyText}>Add a trusted contact first</Text>
            </TouchableOpacity>
          ) : (
            contacts.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.contactRow}
                onPress={() => toggleContact(c.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, selected[c.id] && styles.checkboxOn]}>
                  {selected[c.id] && <Ionicons name="checkmark" size={14} color={Colors.bg} />}
                </View>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  <Text style={styles.contactPhone}>{c.phone}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Start button */}
          <TouchableOpacity
            style={[styles.startBtn, starting && { opacity: 0.65 }]}
            onPress={startWalk}
            disabled={starting}
            activeOpacity={0.85}
          >
            {starting
              ? <ActivityIndicator color={Colors.bg} />
              : <>
                  <MaterialCommunityIcons name="walk" size={20} color={Colors.bg} />
                  <Text style={styles.startBtnText}>Start Walk & Share Location</Text>
                </>
            }
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,182,72,0.15)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.warning,
  },
  liveDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.warning },
  liveText: { color: Colors.warning, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  // Search
  searchWrap: { paddingHorizontal: 16, marginBottom: 6, zIndex: 20 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgSoft,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, height: 46,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },
  resultsList: {
    maxHeight: 200, backgroundColor: Colors.bgAlt,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginTop: 4,
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  resultText: { color: Colors.text, fontSize: 13, flex: 1 },

  // Map
  mapWrap:        { height: '36%', marginHorizontal: 16, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card },
  map:            { flex: 1 },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.bgAlt },
  mapHint:        { color: Colors.textMuted, fontSize: 13 },
  pinWrap:        { alignItems: 'center' },

  // Setup panel
  panel:   { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  mapTip:  { color: Colors.textFaint, fontSize: 13, marginBottom: 4 },
  destChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(56,225,198,0.1)',
    borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.accent,
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 4,
  },
  destChipText: { flex: 1, color: Colors.accent, fontSize: 13, fontWeight: '600' },
  routeInfoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 8,
  },
  routeInfoText: { color: Colors.textMuted, fontSize: 12, flex: 1 },
  policeToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(91,140,255,0.1)',
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 14,
  },
  policeToggleText: { color: Colors.primary, fontSize: 13, fontWeight: '600', flex: 1 },
  policeList: {
    marginTop: 8, backgroundColor: Colors.bgAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  policeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  policeName: { color: Colors.text, fontSize: 13, flex: 1 },
  policeDistance: { color: Colors.textFaint, fontSize: 11 },
  label: { color: Colors.text, fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 10 },
  etaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  etaChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.pill, backgroundColor: Colors.bgSoft,
    borderWidth: 1, borderColor: Colors.border,
  },
  etaChipOn:     { backgroundColor: Colors.accent, borderColor: Colors.accent },
  etaChipText:   { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  etaChipTextOn: { color: Colors.bg },
  etaCustomWrap: {
    backgroundColor: Colors.bgSoft, borderRadius: Radius.pill,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 4, minWidth: 70,
  },
  etaCustom:  { color: Colors.text, fontSize: 13, textAlign: 'center' },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn:    { backgroundColor: Colors.accent, borderColor: Colors.accent },
  contactAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  contactAvatarText: { color: Colors.accent, fontWeight: '800', fontSize: 15 },
  contactName:  { color: Colors.text, fontSize: 14, fontWeight: '600' },
  contactPhone: { color: Colors.textFaint, fontSize: 12, marginTop: 1 },
  emptyContacts: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },
  emptyText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  startBtn: {
    flexDirection: 'row', gap: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    height: 54, marginTop: 24,
    ...Shadow.glow(Colors.accent),
  },
  startBtnText: { color: Colors.bg, fontSize: 15, fontWeight: '800' },

  // Active walk panel
  activePanel: { flex: 1, alignItems: 'center', paddingTop: 18, paddingHorizontal: 24 },
  timerLabel:  { color: Colors.textMuted, fontSize: 13 },
  timer:       { fontSize: 52, fontWeight: '900', marginTop: 4, letterSpacing: 3 },
  timerSub:    { color: Colors.textFaint, fontSize: 12, marginTop: 6, textAlign: 'center' },
  activeBtns:  { width: '100%', gap: 12, marginTop: 28 },
  arrivedBtn: {
    flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accent, borderRadius: Radius.pill,
    paddingVertical: 14, paddingHorizontal: 24,
    ...Shadow.glow(Colors.accent),
  },
  arrivedBtnText: { color: Colors.bg, fontWeight: '800', fontSize: 15 },
  sosTinyBtn: {
    flexDirection: 'row', gap: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,77,94,0.12)',
    borderRadius: Radius.pill, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.danger,
  },
  sosTinyText: { color: Colors.danger, fontWeight: '700', fontSize: 14 },
  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18,
    backgroundColor: Colors.bgSoft, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  shareText: { color: Colors.primary, fontSize: 13, flex: 1 },
  whatsappRow: { marginTop: 8, borderColor: '#25D366' },

  silentBtn: { backgroundColor: 'rgba(150,150,150,0.1)', borderColor: Colors.border },
  silentText: { color: Colors.textMuted },
  silentToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
  },
  silentToggleText: { color: Colors.textFaint, fontSize: 13 },
  safetyActionRow: { flexDirection: 'row', marginTop: 14, width: '100%' },
});
