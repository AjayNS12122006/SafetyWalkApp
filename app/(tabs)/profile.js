import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSession, logoutUser, updateProfile } from '../../lib/storage';
import { searchPlaces } from '../../lib/ors';
import { Colors, Radius, Shadow } from '../../lib/theme';

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];

export default function Profile() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState(null);

  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [address,    setAddress]    = useState('');
  const [homeLabel,  setHomeLabel]  = useState('');
  const [officeLabel,setOfficeLabel]= useState('');

  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    const s = await getSession();
    if (!s) { router.replace('/login'); return; }
    setSession(s);
    setName(s.name || '');
    setPhone(s.phone || '');
    setBloodGroup(s.bloodGroup || '');
    setAddress(s.address || '');
    setHomeLabel(s.home?.label || '');
    setOfficeLabel(s.office?.label || '');
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter your name.'); return; }
    setSaving(true);
    try {
      // Turn the typed address into coordinates so "Walk Me Home" on the
      // home screen can route there, not just display the text.
      const geocode = async (label) => {
        if (!label.trim()) return undefined;
        try {
          const results = await searchPlaces(label.trim());
          const top = results[0];
          return top ? { label: label.trim(), lat: top.latitude, lng: top.longitude } : { label: label.trim() };
        } catch {
          return { label: label.trim() };
        }
      };
      const [home, office] = await Promise.all([geocode(homeLabel), geocode(officeLabel)]);

      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        bloodGroup,
        address: address.trim(),
        home,
        office,
      });
      setEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
          await logoutUser(); router.replace('/login');
        }
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.headerBtns}>
            {editing ? (
              <>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); load(); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.65 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Text style={styles.saveBtnText}>Save</Text>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Ionicons name="pencil" size={16} color={Colors.white} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase() || '?'}</Text>
          </View>
          <Text style={styles.avatarName}>{name || 'Your name'}</Text>
          <Text style={styles.avatarEmail}>{session?.email}</Text>
        </View>

        {/* Personal info */}
        <Section title="Personal information" icon="person-outline">
          <Field
            label="Full name"
            value={name}
            onChangeText={setName}
            editable={editing}
            placeholder="Your full name"
            icon="person-outline"
          />
          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            editable={editing}
            placeholder="Your phone"
            icon="call-outline"
            keyboardType="phone-pad"
          />
          <Field
            label="Address"
            value={address}
            onChangeText={setAddress}
            editable={editing}
            placeholder="Your home address"
            icon="home-outline"
          />
        </Section>

        {/* Blood group */}
        <Section title="Medical info" icon="medkit-outline">
          <Text style={styles.fieldLabel}>Blood group</Text>
          <View style={styles.bloodRow}>
            {BLOOD_GROUPS.map((bg) => (
              <TouchableOpacity
                key={bg}
                style={[styles.bloodChip, bloodGroup === bg && styles.bloodChipOn]}
                onPress={() => editing && setBloodGroup(bloodGroup === bg ? '' : bg)}
                disabled={!editing}
              >
                <Text style={[styles.bloodChipText, bloodGroup === bg && styles.bloodChipTextOn]}>
                  {bg}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!editing && !bloodGroup && (
            <Text style={styles.notSet}>Not set — tap Edit to add your blood group.</Text>
          )}
        </Section>

        {/* Saved locations */}
        <Section title="Saved locations" icon="map-outline">
          <Field
            label="Home"
            value={homeLabel}
            onChangeText={setHomeLabel}
            editable={editing}
            placeholder="e.g. 123 Main Street"
            icon="home-outline"
          />
          <Field
            label="Office / School"
            value={officeLabel}
            onChangeText={setOfficeLabel}
            editable={editing}
            placeholder="e.g. Building A, Tech Park"
            icon="business-outline"
          />
        </Section>

        {/* Account */}
        <Section title="Account" icon="settings-outline">
          <InfoRow icon="mail-outline"  label="Email"      value={session?.email || '—'} />
          <InfoRow icon="key-outline"   label="Password"   value="••••••••" />
          <InfoRow icon="calendar-outline" label="Member since" value={session?.createdAt ? new Date(session.createdAt).getFullYear().toString() : '—'} />
        </Section>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, icon, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={15} color={Colors.accent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({ label, value, onChangeText, editable, placeholder, icon, keyboardType }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldInput, !editable && styles.fieldInputDisabled]}>
        <Ionicons name={icon} size={16} color={Colors.textFaint} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          placeholder={editable ? placeholder : (value || 'Not set')}
          placeholderTextColor={Colors.textFaint}
          keyboardType={keyboardType}
          style={[styles.fieldText, !editable && styles.fieldTextDisabled]}
        />
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={Colors.textFaint} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  center:  { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  container: { paddingHorizontal: 20, paddingBottom: 30 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title:  { color: Colors.text, fontSize: 22, fontWeight: '800' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  editBtn: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 8,
    ...Shadow.glow(Colors.primary),
  },
  editBtnText:   { color: Colors.white, fontWeight: '700', fontSize: 13 },
  cancelBtn: {
    backgroundColor: Colors.bgSoft,
    borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelBtnText: { color: Colors.textMuted, fontWeight: '600', fontSize: 13 },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 8, minWidth: 60,
    alignItems: 'center',
    ...Shadow.glow(Colors.accent),
  },
  saveBtnText: { color: Colors.bg, fontWeight: '700', fontSize: 13 },

  // Avatar
  avatarWrap: { alignItems: 'center', marginBottom: 28 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    ...Shadow.glow(Colors.primary),
  },
  avatarText:  { color: Colors.white, fontSize: 36, fontWeight: '900' },
  avatarName:  { color: Colors.text, fontSize: 20, fontWeight: '800' },
  avatarEmail: { color: Colors.textMuted, fontSize: 13, marginTop: 3 },

  // Section
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  sectionTitle:  { color: Colors.accent, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  sectionBody: {
    backgroundColor: Colors.bgAlt,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },

  // Field
  fieldWrap:  { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  fieldLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgSoft,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, height: 44,
  },
  fieldInputDisabled: { backgroundColor: 'transparent', borderColor: 'transparent' },
  fieldText:         { flex: 1, color: Colors.text, fontSize: 14 },
  fieldTextDisabled: { color: Colors.textMuted },
  notSet:            { color: Colors.textFaint, fontSize: 12, fontStyle: 'italic', paddingHorizontal: 16, paddingBottom: 10 },

  // Blood group
  bloodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  bloodChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radius.pill, backgroundColor: Colors.bgSoft,
    borderWidth: 1, borderColor: Colors.border,
  },
  bloodChipOn:     { backgroundColor: Colors.danger, borderColor: Colors.danger },
  bloodChipText:   { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  bloodChipTextOn: { color: Colors.white },

  // Info row
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  infoLabel: { color: Colors.textMuted, fontSize: 13, flex: 1 },
  infoValue: { color: Colors.text, fontSize: 13, fontWeight: '600' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,77,94,0.1)',
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.danger,
    height: 52, marginTop: 8,
  },
  logoutText: { color: Colors.danger, fontWeight: '700', fontSize: 15 },
});
