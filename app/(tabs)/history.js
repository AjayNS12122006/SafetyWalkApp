import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getHistory, getSession } from '../../lib/storage';
import { Colors, Radius, Shadow } from '../../lib/theme';

const STATUS = {
  active:     { label: 'In progress',     color: Colors.warning,  bg: 'rgba(255,182,72,0.12)',  icon: 'walk' },
  arrived:    { label: 'Arrived safely',  color: Colors.accent,   bg: 'rgba(56,225,198,0.12)',  icon: 'checkmark-circle-outline' },
  sos_auto:   { label: 'Auto-SOS fired',  color: Colors.danger,   bg: 'rgba(255,77,94,0.12)',   icon: 'warning-outline' },
  sos_manual: { label: 'SOS (manual)',    color: Colors.danger,   bg: 'rgba(255,77,94,0.12)',   icon: 'alert-circle-outline' },
};

const FILTERS = ['All', 'Safe', 'SOS', 'Active'];

export default function History() {
  const insets = useSafeAreaInsets();
  const [walks, setWalks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]     = useState('All');
  const [detail, setDetail]     = useState(null);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    const session = await getSession();
    if (!session) { router.replace('/login'); return; }
    try {
      const h = await getHistory();
      setWalks(h ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = walks.filter((w) => {
    if (filter === 'All')    return true;
    if (filter === 'Safe')   return w.status === 'arrived';
    if (filter === 'SOS')    return w.status === 'sos_auto' || w.status === 'sos_manual';
    if (filter === 'Active') return w.status === 'active';
    return true;
  });

  const safeCount   = walks.filter((w) => w.status === 'arrived').length;
  const sosCount    = walks.filter((w) => w.status.startsWith('sos')).length;
  const totalWalks  = walks.length;

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Walk History</Text>
        <Text style={styles.sub}>{totalWalks} walk{totalWalks !== 1 ? 's' : ''} recorded</Text>
      </View>

      {/* Summary cards */}
      {totalWalks > 0 && (
        <View style={styles.summaryRow}>
          <SummaryCard icon="walk" value={totalWalks} label="Total" color={Colors.primary} isMCI />
          <SummaryCard icon="checkmark-circle-outline" value={safeCount} label="Safe" color={Colors.accent} />
          <SummaryCard icon="alert-circle-outline" value={sosCount} label="SOS" color={sosCount > 0 ? Colors.danger : Colors.textFaint} />
        </View>
      )}

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipOn]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="time-outline" size={40} color={Colors.textFaint} />
            <Text style={styles.emptyTitle}>
              {filter === 'All' ? 'No walks yet' : `No ${filter.toLowerCase()} walks`}
            </Text>
            <Text style={styles.emptyDesc}>
              {filter === 'All'
                ? 'Start a safety walk and it will appear here.'
                : 'Try a different filter.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = STATUS[item.status] || STATUS.arrived;
          return (
            <TouchableOpacity
              style={styles.walkCard}
              onPress={() => setDetail(item)}
              activeOpacity={0.85}
            >
              <View style={[styles.statusIcon, { backgroundColor: meta.bg }]}>
                <Ionicons name={meta.icon} size={20} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.walkDest} numberOfLines={1}>
                  {item.destinationLabel || 'Walk'}
                </Text>
                <Text style={styles.walkTime}>{formatDate(item.startedAt)}</Text>
              </View>
              <View style={styles.walkRight}>
                <View style={[styles.statusBadge, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                  <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.textFaint} style={{ marginTop: 4 }} />
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Detail modal */}
      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetail(null)} />
        {detail && (
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />

            {/* Status banner */}
            {(() => {
              const meta = STATUS[detail.status] || STATUS.arrived;
              return (
                <View style={[styles.modalBanner, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.color} />
                  <Text style={[styles.modalBannerText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              );
            })()}

            <Text style={styles.modalDest} numberOfLines={2}>{detail.destinationLabel || 'Walk'}</Text>

            <View style={styles.detailGrid}>
              <DetailRow icon="calendar-outline"    label="Started"   value={formatDate(detail.startedAt)} />
              {detail.endedAt && (
                <DetailRow icon="checkmark-done-outline" label="Ended" value={formatDate(detail.endedAt)} />
              )}
              <DetailRow icon="timer-outline"       label="ETA set"   value={`${detail.etaMinutes} min`} />
              {detail.endedAt && detail.startedAt && (
                <DetailRow
                  icon="hourglass-outline"
                  label="Duration"
                  value={formatDuration(detail.endedAt - detail.startedAt)}
                />
              )}
              {detail.lastLocation && (
                <DetailRow
                  icon="location-outline"
                  label="Last location"
                  value={`${detail.lastLocation.latitude?.toFixed(5)}, ${detail.lastLocation.longitude?.toFixed(5)}`}
                />
              )}
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setDetail(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </View>
  );
}

function SummaryCard({ icon, value, label, color, isMCI = false }) {
  return (
    <View style={styles.summaryCard}>
      {isMCI
        ? <MaterialCommunityIcons name={icon} size={18} color={color} />
        : <Ionicons name={icon} size={18} color={color} />
      }
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={Colors.textFaint} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },

  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:  { color: Colors.text, fontSize: 22, fontWeight: '800' },
  sub:    { color: Colors.textMuted, fontSize: 13, marginTop: 3 },

  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.bgAlt,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: 12, alignItems: 'center', gap: 4,
  },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryLabel: { color: Colors.textFaint, fontSize: 11 },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.pill, backgroundColor: Colors.bgSoft,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterChipOn:  { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText:    { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterTextOn:  { color: Colors.white },

  list:      { paddingHorizontal: 20, paddingVertical: 8, gap: 10, paddingBottom: 30 },
  listEmpty: { flex: 1, justifyContent: 'center' },
  walkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bgAlt,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: 14,
  },
  statusIcon:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  walkDest:       { color: Colors.text, fontSize: 14, fontWeight: '700' },
  walkTime:       { color: Colors.textFaint, fontSize: 12, marginTop: 2 },
  walkRight:      { alignItems: 'flex-end', gap: 2 },
  statusBadge: {
    borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  emptyWrap:  { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 12 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  emptyDesc:  { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: Colors.bgAlt,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingTop: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  modalBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: Radius.md, borderWidth: 1,
    padding: 10, marginBottom: 16,
  },
  modalBannerText: { fontWeight: '700', fontSize: 14 },
  modalDest: { color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 18, lineHeight: 24 },
  detailGrid: { gap: 12 },
  detailRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailLabel:{ color: Colors.textMuted, fontSize: 13, width: 90 },
  detailValue:{ color: Colors.text, fontSize: 13, flex: 1, fontWeight: '600' },
  closeBtn: {
    backgroundColor: Colors.bgSoft, borderRadius: Radius.md,
    height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 24,
    borderWidth: 1, borderColor: Colors.border,
  },
  closeBtnText: { color: Colors.textMuted, fontWeight: '700', fontSize: 14 },
});
