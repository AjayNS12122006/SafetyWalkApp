import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sendSOS } from '../../lib/sos';
import { getContacts, getHistory, getSession, logoutUser } from '../../lib/storage';
import { Colors, Radius, Shadow } from '../../lib/theme';

const STATUS_META = {
  active:     { label: 'Walk in progress', color: Colors.warning,  icon: 'walk' },
  arrived:    { label: 'Arrived safely',   color: Colors.accent,   icon: 'checkmark-circle' },
  sos_auto:   { label: 'Auto-SOS fired',   color: Colors.danger,   icon: 'warning' },
  sos_manual: { label: 'Manual SOS fired', color: Colors.danger,   icon: 'alert-circle' },
};

export default function Home() {
  const insets = useSafeAreaInsets();
  const [session, setSession]   = useState(null);
  const [contacts, setContacts] = useState([]);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);

  // Pulse animation for the SOS ring
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const s = await getSession();
      if (!s) { router.replace('/login'); return; }
      setSession(s);
      const [c, h] = await Promise.all([getContacts(), getHistory()]);
      setContacts(c ?? []);
      setHistory(h ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => { await logoutUser(); router.replace('/login'); },
      },
    ]);
  };

  const confirmSOS = () => {
    if (contacts.length === 0) {
      Alert.alert(
        'No contacts yet',
        'Add at least one trusted contact so someone receives your alert.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Contact', onPress: () => router.push('/(tabs)/contacts') },
        ]
      );
      return;
    }
    Alert.alert(
      '🚨 Send SOS?',
      `This will open your SMS app pre-filled to ${contacts.length} contact${contacts.length > 1 ? 's' : ''} with your live location.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send SOS', style: 'destructive', onPress: triggerSOS },
      ]
    );
  };

  const triggerSOS = async () => {
    setSosLoading(true);
    try {
      await sendSOS({ contacts, userName: session?.name, reason: 'SOS' });
    } catch (e) {
      Alert.alert('SOS failed', e.message);
    } finally {
      setSosLoading(false);
    }
  };

  const activeWalk = history.find((w) => w.status === 'active');
  const recentWalks = history.slice(0, 3);
  const safeCount  = history.filter((w) => w.status === 'arrived').length;

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hi, {session?.name?.split(' ')[0] || 'there'} 👋
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, activeWalk ? styles.dotActive : styles.dotSafe]} />
            <Text style={styles.statusText}>
              {activeWalk ? 'Walk in progress' : "You're safe"}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.avatarBtn} onPress={handleLogout}>
          <Text style={styles.avatarText}>
            {session?.name?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Active walk banner ── */}
      {activeWalk && (
        <TouchableOpacity
          style={styles.activeBanner}
          onPress={() => router.push('/(tabs)/walk')}
          activeOpacity={0.85}
        >
          <View style={styles.activeBannerDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>Walk in progress</Text>
            <Text style={styles.activeBannerSub} numberOfLines={1}>
              {activeWalk.destinationLabel}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.warning} />
        </TouchableOpacity>
      )}

      {/* ── SOS button ── */}
      <View style={styles.sosSection}>
        <Animated.View style={[styles.sosPulse, { transform: [{ scale: pulseAnim }] }]} />
        <TouchableOpacity
          style={styles.sosButton}
          onPress={confirmSOS}
          disabled={sosLoading}
          activeOpacity={0.9}
        >
          {sosLoading
            ? <ActivityIndicator color={Colors.white} size="large" />
            : <>
                <Ionicons name="alert-circle" size={34} color={Colors.white} />
                <Text style={styles.sosLabel}>SOS</Text>
                <Text style={styles.sosHint}>Tap to alert contacts</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* ── Start walk card ── */}
      <TouchableOpacity
        style={styles.walkCard}
        onPress={() => router.push('/(tabs)/walk')}
        activeOpacity={0.88}
      >
        <View style={styles.walkIconWrap}>
          <MaterialCommunityIcons name="walk" size={26} color={Colors.bg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.walkCardTitle}>Start a Safety Walk</Text>
          <Text style={styles.walkCardSub}>Share live location · Set ETA · Auto-SOS</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.bg} />
      </TouchableOpacity>

      {/* ── Walk Me Home ── */}
      <TouchableOpacity
        style={styles.homeCard}
        onPress={() => {
          if (session?.home?.lat && session?.home?.lng) {
            router.push({
              pathname: '/(tabs)/walk',
              params: {
                destLat: String(session.home.lat),
                destLng: String(session.home.lng),
                destLabel: session.home.label || 'Home',
              },
            });
          } else {
            Alert.alert(
              'Set your home address first',
              'Add it in your profile so SafetyWalk can route you home in one tap.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Go to Profile', onPress: () => router.push('/(tabs)/profile') },
              ]
            );
          }
        }}
        activeOpacity={0.88}
      >
        <View style={styles.homeIconWrap}>
          <Ionicons name="home" size={22} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.homeCardTitle}>Walk Me Home</Text>
          <Text style={styles.homeCardSub} numberOfLines={1}>
            {session?.home?.label ? `To ${session.home.label}` : 'Set your home address to enable this'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textFaint} />
      </TouchableOpacity>

      {/* ── Stats row ── */}
      <View style={styles.statsRow}>
        <StatCard icon="people" value={contacts.length} label="Contacts" color={Colors.primary} />
        <StatCard icon="walk"   value={history.length}  label="Walks"    color={Colors.accent}   isMCI />
        <StatCard icon="shield-checkmark" value={safeCount} label="Safe arrivals" color={Colors.accent} />
      </View>

      {/* ── Recent walks ── */}
      {recentWalks.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent walks</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentWalks.map((w) => {
            const meta = STATUS_META[w.status] || STATUS_META.arrived;
            return (
              <View key={w.id} style={styles.recentRow}>
                <View style={[styles.recentDot, { backgroundColor: meta.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentDest} numberOfLines={1}>
                    {w.destinationLabel || 'Walk'}
                  </Text>
                  <Text style={styles.recentMeta}>
                    {meta.label} · {timeAgo(w.startedAt)}
                  </Text>
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* ── Quick tips ── */}
      <Text style={styles.sectionTitle}>Safety tips</Text>
      <View style={styles.tipsWrap}>
        {TIPS.map((tip) => (
          <View key={tip.title} style={styles.tipCard}>
            <Ionicons name={tip.icon} size={20} color={Colors.accent} />
            <Text style={styles.tipTitle}>{tip.title}</Text>
            <Text style={styles.tipDesc}>{tip.desc}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

function StatCard({ icon, value, label, color, isMCI = false }) {
  return (
    <View style={styles.statCard}>
      {isMCI
        ? <MaterialCommunityIcons name={icon} size={20} color={color} />
        : <Ionicons name={icon} size={20} color={color} />
      }
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TIPS = [
  { icon: 'share-social-outline', title: 'Share before you walk', desc: 'Always start a walk so someone knows your route and ETA.' },
  { icon: 'people-outline',       title: 'Add 2+ contacts',       desc: 'More contacts means better coverage if one misses your alert.' },
  { icon: 'battery-half-outline', title: 'Keep battery charged',  desc: 'A dead phone during a walk defeats the whole system.' },
  { icon: 'moon-outline',         title: 'Night mode built-in',   desc: 'The app is tuned for low-light legibility every night.' },
];

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: 20, paddingBottom: 30 },

  // Header
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting:   { color: Colors.text, fontSize: 22, fontWeight: '800' },
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  dotSafe:    { backgroundColor: Colors.accent },
  dotActive:  { backgroundColor: Colors.warning },
  statusText: { color: Colors.textMuted, fontSize: 13 },
  avatarBtn:  {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.glow(Colors.primary),
  },
  avatarText: { color: Colors.white, fontWeight: '800', fontSize: 16 },

  // Active walk banner
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,182,72,0.12)',
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.warning,
    padding: 14, marginBottom: 16,
  },
  activeBannerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.warning },
  activeBannerTitle: { color: Colors.warning, fontSize: 14, fontWeight: '700' },
  activeBannerSub:   { color: Colors.textMuted, fontSize: 12, marginTop: 1 },

  // SOS
  sosSection: { alignItems: 'center', marginVertical: 10 },
  sosPulse: {
    position: 'absolute',
    width: 210, height: 210, borderRadius: 105,
    backgroundColor: 'rgba(255,77,94,0.12)',
  },
  sosButton: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: Colors.danger,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.glow(Colors.danger),
  },
  sosLabel: { color: Colors.white, fontSize: 28, fontWeight: '900', marginTop: 2, letterSpacing: 1 },
  sosHint:  { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },

  // Walk card
  walkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.accent, borderRadius: Radius.lg,
    padding: 16, marginTop: 20,
    ...Shadow.card,
  },
  walkIconWrap: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(11,18,38,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  walkCardTitle: { color: Colors.bg, fontSize: 16, fontWeight: '800' },
  walkCardSub:   { color: 'rgba(11,18,38,0.7)', fontSize: 12, marginTop: 2 },

  // Walk Me Home
  homeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.bgAlt, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginTop: 12,
  },
  homeIconWrap: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(91,140,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  homeCardTitle: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  homeCardSub:   { color: Colors.textFaint, fontSize: 12, marginTop: 2 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  statCard: {
    flex: 1, backgroundColor: Colors.bgAlt,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: 14, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { color: Colors.textFaint, fontSize: 11, textAlign: 'center' },

  // Recent walks
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionTitle:{ color: Colors.text, fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 12 },
  seeAll:      { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgAlt, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: 8,
  },
  recentDot:  { width: 10, height: 10, borderRadius: 5 },
  recentDest: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  recentMeta: { color: Colors.textFaint, fontSize: 12, marginTop: 2 },

  // Tips
  tipsWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tipCard: {
    width: '47%', backgroundColor: Colors.bgAlt,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 6,
  },
  tipTitle: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  tipDesc:  { color: Colors.textFaint, fontSize: 11, lineHeight: 15 },
});
